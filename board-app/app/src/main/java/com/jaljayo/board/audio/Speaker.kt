package com.jaljayo.board.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig
import java.io.File
import java.util.concurrent.Executors

// 대답 문장을 소리로 낸다. 11/11 이도 님 결정: 수퍼토닉 3 여자3 목소리(F3), 원래 속도, 쉼표 자리만 0.4초.
// sherpa-onnx 8비트 판(sherpa-onnx-supertonic-3-tts-int8-2026-05-11). 모델 파일은 경로가 필요해 처음 켤 때 앱 저장 공간으로 복사한다.
class Speaker(private val context: Context, private val onSpeaking: (Boolean) -> Unit) {
    private val queue = Executors.newSingleThreadExecutor()
    @Volatile private var gen = 0               // cancel()이 올리면 줄 서 있던 말과 지금 말을 버린다
    @Volatile private var track: AudioTrack? = null
    @Volatile var text = ""; private set          // 지금 말하고 있는 문장(없으면 빈칸)

    /** 지금 말과 줄 서 있는 말을 모두 멈춘다 */
    fun cancel() { gen++; try { track?.stop() } catch (_: Exception) {} }
    private val tts: OfflineTts

    init {
        val dir = File(context.filesDir, "tts_st")
        if (!File(dir, ".ready").exists()) {
            copyAssets("models/tts_st", dir)
            File(dir, ".ready").writeText("ok")
        }
        tts = OfflineTts(null, OfflineTtsConfig(model = OfflineTtsModelConfig(
            supertonic = OfflineTtsSupertonicModelConfig(
                durationPredictor = "$dir/duration_predictor.int8.onnx", textEncoder = "$dir/text_encoder.int8.onnx",
                vectorEstimator = "$dir/vector_estimator.int8.onnx", vocoder = "$dir/vocoder.int8.onnx",
                ttsJson = "$dir/tts.json", unicodeIndexer = "$dir/unicode_indexer.bin", voiceStyle = "$dir/voice.bin"),
            numThreads = 4,
        )))
    }

    private fun copyAssets(path: String, to: File) {
        val list = context.assets.list(path) ?: emptyArray()
        if (list.isEmpty()) {
            to.parentFile?.mkdirs()
            context.assets.open(path).use { i -> to.outputStream().use { o -> i.copyTo(o) } }
            return
        }
        to.mkdirs()
        for (name in list) copyAssets("$path/$name", File(to, name))
    }

    // ---------- 11/11: 정해진 문장은 미리 만들어 저장, 두 문장 이상은 첫 문장부터 바로 말하기 ----------
    // 같은 문장은 seed를 고정해 늘 같은 소리라, 한 번 만든 소리를 파일로 남겨 다시 쓴다(소리가 바뀌지 않는다)
    private val cacheDir = File(context.filesDir, "tts_cache_f3_s8_p2")   // p2: 쉼표 여러 개는 짧게(11/11).also { it.mkdirs() }
    private val genQueue = Executors.newSingleThreadExecutor()   // 말할 소리 만들기(말하는 순서대로)
    private val ttsLock = Any()
    private var sampleRate = 44100

    private fun key(t: String) = java.security.MessageDigest.getInstance("SHA-1").digest(t.toByteArray()).joinToString("") { "%02x".format(it) }

    private fun cached(t: String): ShortArray? {
        val f = File(cacheDir, key(t) + ".pcm"); if (!f.exists()) return null
        val b = java.nio.ByteBuffer.wrap(f.readBytes()).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        sampleRate = b.getInt(); return ShortArray((b.remaining()) / 2) { b.getShort() }
    }

    /** 문장 하나의 소리. 저장본이 있으면 그것, 없으면 만들어 저장한다 */
    private fun synth(t: String): ShortArray {
        cached(t)?.let { return it }
        val t0 = System.currentTimeMillis()
        val pcm = synchronized(ttsLock) {
            cached(t) ?: run {
                // sid 2 = F3(voice.bin 순서 F1~F5, M1~M5). 속도 1.05·단계 8은 수퍼토닉 기본값, seed를 고정해 같은 문장은 늘 같은 소리
                val audio = tts.generateWithConfig(t, GenerationConfig(sid = VOICE, speed = 1.05f, numSteps = 8, extra = mapOf("lang" to "ko", "seed" to "7")))
                sampleRate = audio.sampleRate
                val wave = commaPause(audio.samples, audio.sampleRate, t.count { it == ',' })
                val out = ShortArray(wave.size) { (wave[it].coerceIn(-1f, 1f) * 32767).toInt().toShort() }
                try {
                    val b = java.nio.ByteBuffer.allocate(4 + out.size * 2).order(java.nio.ByteOrder.LITTLE_ENDIAN)
                    b.putInt(audio.sampleRate); out.forEach { b.putShort(it) }
                    cacheDir.mkdirs()
                    val tmp = File(cacheDir, key(t) + ".tmp"); tmp.writeBytes(b.array()); tmp.renameTo(File(cacheDir, key(t) + ".pcm"))
                } catch (e: Exception) { Log.w(TAG, "저장 실패", e) }
                Log.i(TAG, "말 만들기 ${System.currentTimeMillis() - t0}ms, 소리 ${out.size * 1000L / audio.sampleRate}ms: $t")
                out
            }
        }
        return pcm
    }

    /** 보드가 한가할 때 정해진 문장을 미리 만들어 둔다(assets/tts_warm.txt). idle()이 false면 기다린다 */
    fun warmUp(idle: () -> Boolean) {
        val list = try { context.assets.open("tts_warm.txt").bufferedReader().readLines().map { it.trim() }.filter { it.isNotEmpty() } } catch (e: Exception) { emptyList() }
        Thread({
            var made = 0
            for (t in list) {
                if (File(cacheDir, key(t) + ".pcm").exists()) continue
                while (!idle()) Thread.sleep(500)
                try { synth(t); made++ } catch (e: Exception) { Log.w(TAG, "미리 만들기 실패: $t", e) }
            }
            Log.i(TAG, "정해진 문장 미리 만들기 끝(${list.size}개 중 새로 $made 개)")
        }, "tts-warm").apply { priority = Thread.MIN_PRIORITY; isDaemon = true }.start()
    }

    /** 말할 문장을 차례로 낸다. 문장이 여럿이면 첫 문장을 내는 동안 다음 문장을 만든다. 다 말하면 done을 부른다 */
    fun say(text: String, notBefore: Long = 0L, onFirstReady: (Long) -> Unit = {}, done: () -> Unit = {}) {
        if (text.isBlank()) { done(); return }
        val my = gen
        val parts = text.trim().split(Regex("(?<=[.?!])\\s+")).filter { it.isNotBlank() }
        queue.execute {
            if (my != gen) { done(); return@execute }
            try {
                this.text = text
                onSpeaking(true)
                val jobs = parts.map { p -> genQueue.submit<ShortArray> { if (my != gen) ShortArray(0) else synth(p) } }
                for ((i, job) in jobs.withIndex()) {
                    val pcm = job.get()
                    if (my != gen || pcm.isEmpty()) break
                    if (i == 0) {   // 첫 소리는 정해 준 때(notBefore)보다 먼저 내지 않는다
                        onFirstReady(System.currentTimeMillis())
                        while (System.currentTimeMillis() < notBefore && my == gen) Thread.sleep(20)
                        if (my != gen) break
                    }
                    // 11/11 이도 님: 문장 사이가 문장 안처럼 이어지게, 문장 앞뒤의 빈 소리를 잘라 내고 0.15초만 쉰다
                    play(trimEdges(pcm, head = i > 0, tail = i < jobs.size - 1), my)
                    if (i < jobs.size - 1 && my == gen) Thread.sleep(150)
                }
            } catch (e: Exception) {
                Log.e(TAG, "말하기 실패", e)
            } finally {
                if (my == gen) Thread.sleep(250) // 스피커 잔향이 마이크로 들어가지 않게 조금 더 막는다
                this.text = ""
                onSpeaking(false)
                done()
            }
        }
    }

    /** 앞(head)·뒤(tail)의 조용한 부분을 잘라 낸다. 말소리 가장자리는 0.02초 남긴다 */
    private fun trimEdges(pcm: ShortArray, head: Boolean, tail: Boolean): ShortArray {
        if (pcm.isEmpty() || (!head && !tail)) return pcm
        val th = (pcm.maxOf { kotlin.math.abs(it.toInt()) } * 0.03).toInt()
        val keep = sampleRate / 50
        val a = if (head) maxOf(0, pcm.indexOfFirst { kotlin.math.abs(it.toInt()) > th } - keep) else 0
        val b = if (tail) minOf(pcm.size, pcm.indexOfLast { kotlin.math.abs(it.toInt()) > th } + keep) else pcm.size
        return if (a < b) pcm.copyOfRange(a, b) else pcm
    }

    private fun play(pcm: ShortArray, my: Int) {
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder().setSampleRate(sampleRate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
        track = t
        try {
            t.write(pcm, 0, pcm.size); t.play()
            val until = System.currentTimeMillis() + pcm.size * 1000L / sampleRate + 100
            while (System.currentTimeMillis() < until && my == gen) Thread.sleep(20)
        } finally {
            track = null
            try { t.stop() } catch (_: Exception) {}
            t.release()
        }
    }

    companion object {
        const val TAG = "JaljayoSpeak"
        private const val VOICE = 2
        private const val PAUSE_S = 0.4f        // 쉼표가 하나인 문장
        private const val PAUSE_LIST_S = 0.15f  // 11/11 이도 님: 쉼표가 둘 이상(늘어놓는 문장)이면 쉼표마다 짧게

        /** 쉼표 수 k만큼, 말 안쪽의 조용한 구간 중 긴 것 k개를 PAUSE_S초로 늘린다(나머지 공백은 그대로).
         *  문장을 쉼표에서 쪼개 읽으면 억양이 바뀌어서, 한 번에 읽은 소리에서 공백만 늘린다 */
        fun commaPause(w: FloatArray, sr: Int, k: Int): FloatArray {
            if (k == 0 || w.isEmpty()) return w
            val hop = sr / 100; val n = w.size / hop
            if (n < 3) return w
            val e = FloatArray(n) { i -> var s = 0f; for (j in i * hop until (i + 1) * hop) s += w[j] * w[j]; kotlin.math.sqrt(s / hop) }
            val th = 0.03f * (e.maxOrNull() ?: 0f)
            val first = e.indexOfFirst { it > th }; val last = e.indexOfLast { it > th }
            if (first < 0) return w
            val runs = mutableListOf<IntArray>(); var i = first
            while (i <= last) {
                if (e[i] <= th) { var j = i; while (j <= last && e[j] <= th) j++; runs += intArrayOf(i, j); i = j } else i++
            }
            val pick = runs.sortedByDescending { it[1] - it[0] }.take(k).sortedBy { it[0] }
            val out = ArrayList<Float>(w.size + k * sr / 2); var from = 0
            for (r in pick) {
                val a = r[0] * hop; val b = r[1] * hop; val mid = (a + b) / 2; val need = (sr * (if (k == 1) PAUSE_S else PAUSE_LIST_S)).toInt() - (b - a)
                for (x in from until mid) out += w[x]
                repeat(maxOf(need, 0)) { out += 0f }
                from = mid
            }
            for (x in from until w.size) out += w[x]
            return out.toFloatArray()
        }
    }
}
