package com.jaljayo.board.audio

import android.content.res.AssetManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import java.nio.ByteBuffer
import java.nio.ByteOrder

// 듣기 알림 소리(11/11 이도 님, 원본은 GoodNight/outputs/wakeup-chimes): "잘자요"를 알아들었을 때 sounds/wake.wav(02-wood.wav),
// 명령을 알아들었을 때 sounds/understood.wav(wood-understood-dewdrop-notes.wav), 듣다가 그냥 꺼질 때 sounds/off.wav(wood-listening-off.wav). 원본이 작아(최대 0.24~0.28) 최대 0.9로 키워 낸다.
class Chime(assets: AssetManager, path: String) {
    private val main = Handler(Looper.getMainLooper())
    private val rate: Int
    private val pcm: ShortArray

    init {
        val b = ByteBuffer.wrap(assets.open(path).use { it.readBytes() }).order(ByteOrder.LITTLE_ENDIAN)
        var r = 48000; var data = ShortArray(0); var p = 12
        while (p + 8 <= b.limit()) {                       // WAV 조각을 차례로 읽는다(fmt: 표본 빈도, data: 16비트 소리)
            val id = String(ByteArray(4) { b.get(p + it) }); val size = b.getInt(p + 4); val body = p + 8
            if (id == "fmt ") r = b.getInt(body + 4)
            if (id == "data") data = ShortArray(size / 2) { b.getShort(body + it * 2) }
            p = body + size + (size and 1)
        }
        val peak = data.maxOfOrNull { kotlin.math.abs(it.toInt()) }?.coerceAtLeast(1) ?: 1
        val gain = 0.9f * Short.MAX_VALUE / peak
        rate = r; pcm = ShortArray(data.size) { (data[it] * gain).toInt().coerceIn(-32768, 32767).toShort() }
    }

    fun play(done: () -> Unit) {
        val track = try {
            AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
        } catch (e: Exception) { done(); return }
        track.write(pcm, 0, pcm.size)
        track.play()
        main.postDelayed({ try { track.stop(); track.release() } catch (_: Exception) {}; done() }, pcm.size * 1000L / rate + 60)
    }
}
