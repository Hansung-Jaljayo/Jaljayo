package com.jaljayo.board.audio

import android.annotation.SuppressLint
import android.content.res.AssetManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineSenseVoiceModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig

// 마이크 → 말 끝 감지(silero VAD) → 음성 인식(SenseVoice). 선배 앱과 같은 모델, 음성 인식은 CPU 4스레드.
// 숫자 바꾸기(ITN)는 끈다: 모델이 "삼십 도"처럼 한글 숫자로 학습했기 때문이다.
class Listener(assets: AssetManager, private val onText: (String, Long) -> Unit) {
    @Volatile var muted = false          // 알림 소리·알람 소리가 나는 동안에는 듣지 않는다
    // 11/11 이도 님: 침대가 말하는 동안에도 "잘자요"는 들어서 말을 멈춘다. 그동안은 1.5초씩 짧게 끊어 받아 적고 onBarge로만 넘긴다
    @Volatile var speaking = false
    @Volatile var onBarge: ((String) -> Unit)? = null
    @Volatile private var running = false
    private val sampleRate = 16000
    // 말 구간 앞 여유 0.3초(Preroll.kt). 보관은 30초(VAD 구간 최대 8초보다 넉넉히)
    private val preroll = Preroll(sampleRate * 30)
    private val prerollSamples = (sampleRate * 0.3).toInt()

    // 마이크가 멀어도 듣도록 입력 크기를 자동으로 맞춘다. 작은 소리일수록 많이 키우되 가까이서 말할 때는 깨지지 않게 줄인다
    private var wasSpeaking = false
    private var level = 0f
    private var lastGain = 1f
    private var levelLogAt = 0L
    private fun boost(x: FloatArray) {
        var peak = 0f
        for (v in x) peak = maxOf(peak, kotlin.math.abs(v))
        level = if (peak > level) level * 0.5f + peak * 0.5f else level * 0.98f + peak * 0.02f
        lastGain = (TARGET / maxOf(level, TARGET / MAX_GAIN)).coerceIn(1f, MAX_GAIN)
        for (i in x.indices) x[i] = (x[i] * lastGain).coerceIn(-1f, 1f)
        val now = System.currentTimeMillis()
        if (now >= levelLogAt) { levelLogAt = now + 5000; Log.i(TAG, "입력 크기 최고=%.4f 키움=%.1f배".format(peak, lastGain)) }
    }

    private val vad = Vad(assets, VadModelConfig(
        sileroVadModelConfig = SileroVadModelConfig(model = "models/silero_vad.onnx", threshold = 0.3f,
            minSilenceDuration = 0.7f, minSpeechDuration = 0.25f, windowSize = 512, maxSpeechDuration = 8f),
        sampleRate = sampleRate, numThreads = 1,
    ))
    private val fastVad = Vad(assets, VadModelConfig(
        sileroVadModelConfig = SileroVadModelConfig(model = "models/silero_vad.onnx", threshold = 0.3f,
            minSilenceDuration = 0.25f, minSpeechDuration = 0.25f, windowSize = 512, maxSpeechDuration = 1.5f),
        sampleRate = sampleRate, numThreads = 1,
    ))
    private val asr = OfflineRecognizer(assets, OfflineRecognizerConfig(
        featConfig = FeatureConfig(sampleRate = sampleRate, featureDim = 80),
        modelConfig = OfflineModelConfig(
            senseVoice = OfflineSenseVoiceModelConfig(model = "models/asr/model.int8.onnx", language = "ko", useInverseTextNormalization = false),
            tokens = "models/asr/tokens.txt", numThreads = 4,
        ),
    ))

    @SuppressLint("MissingPermission")
    fun start() {
        if (running) return
        running = true
        Thread({
            val min = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sampleRate, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, maxOf(min, 512 * 8))
            rec.startRecording()
            Log.i(TAG, "마이크 듣기 시작")
            val buf = ShortArray(512)
            while (running) {
                val n = rec.read(buf, 0, buf.size)
                if (n <= 0) continue
                if (muted) { vad.reset(); fastVad.reset(); preroll.reset(); continue }
                val x = FloatArray(n) { buf[it] / 32768f }
                boost(x)
                if (speaking) {
                    if (!wasSpeaking) { vad.reset(); preroll.reset(); wasSpeaking = true }
                    fastVad.acceptWaveform(x)
                    while (!fastVad.empty()) {
                        val seg = fastVad.front(); fastVad.pop()
                        val stream = asr.createStream(); stream.acceptWaveform(seg.samples, sampleRate); asr.decode(stream)
                        val text = asr.getResult(stream).text; stream.release()
                        Log.i(TAG, "말하는 중 들음: $text")
                        if (text.isNotBlank()) onBarge?.invoke(text)
                    }
                    continue
                }
                if (wasSpeaking) { fastVad.reset(); wasSpeaking = false }
                preroll.add(x)
                vad.acceptWaveform(x)
                while (!vad.empty()) {
                    val seg = vad.front(); vad.pop()
                    val t0 = System.currentTimeMillis()
                    val stream = asr.createStream()
                    stream.acceptWaveform(preroll.withPreroll(seg.start.toLong(), seg.samples, prerollSamples), sampleRate)
                    asr.decode(stream)
                    val text = asr.getResult(stream).text
                    stream.release()
                    val ms = System.currentTimeMillis() - t0
                    // 위치 기준 확인용: 구간 끝 뒤 남은 샘플(말 끝 침묵 0.4초 언저리면 기준이 맞음)
                    Log.d(TAG, "구간 start=${seg.start} len=${seg.samples.size} 받은 샘플=${preroll.total} 끝 뒤=${preroll.total - seg.start - seg.samples.size}")
                    Log.i(TAG, "들음(${ms}ms): $text")
                    if (text.isNotBlank()) onText(text, ms)
                }
            }
            rec.stop(); rec.release()
        }, "listener").start()
    }

    fun stop() { running = false }

    companion object {
        const val TAG = "JaljayoListen"
        private const val TARGET = 0.7f     // 말소리를 맞출 크기
        private const val MAX_GAIN = 20f    // 최대로 키우는 배수
    }
}
