package com.jaljayo.board.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin

// 알람 소리: "삐삐-" 하는 짧은 소리를 버튼이나 센서로 끌 때까지 되풀이한다(소리 파일 없이 만든다)
class AlarmSound {
    private var track: AudioTrack? = null

    /** level: 폰 앱 알람 소리 크기 1·2·3(11/14). 2가 예전 크기(진폭 0.5)와 같다 */
    @Synchronized fun start(level: Int = 2) {
        if (track != null) return
        val gain = when (level) { 1 -> 0.3f; 3 -> 1f; else -> 0.55f }
        val rate = 22050
        val pcm = ShortArray(rate) // 1초: 0.15초 소리 · 0.1초 쉼 · 0.15초 소리 · 0.6초 쉼
        fun beep(from: Double, to: Double) {
            for (i in (from * rate).toInt() until (to * rate).toInt())
                pcm[i] = (sin(2 * PI * 880 * i / rate) * 0.9 * Short.MAX_VALUE).toInt().toShort()
        }
        beep(0.0, 0.15); beep(0.25, 0.40)
        track = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build().apply {
                write(pcm, 0, pcm.size)
                setLoopPoints(0, pcm.size, -1)
                setVolume(gain)
                play()
            }
    }

    @Synchronized fun stop() {
        track?.run { stop(); release() }
        track = null
    }

    val playing get() = track != null
}
