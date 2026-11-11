package com.jaljayo.board

import org.json.JSONObject
import java.io.File

// 보드 시계(11/11 이도 님): 폰은 어쩌다 한 번 붙어 시각을 맞춰 주고, 그 뒤로는 보드가 스스로 센다.
// 맞춘 값을 파일에 남겨 앱을 다시 켜도 그대로 쓴다. 보드가 다시 부팅됐으면(시계 배터리가 없음) 보드 시계가 인터넷 시간으로
// 맞춰졌을 때만 믿는다. 한 번도 맞춘 적이 없고 인터넷 시간도 없을 때만 폰 연결을 안내한다.
class BoardClock(private val file: File, private val bootId: () -> String, private val autoTime: () -> Boolean,
                 private val sys: () -> Long = { System.currentTimeMillis() }) {
    @Volatile var offset = 0L; private set
    @Volatile var valid = false; private set
    fun now() = sys() + offset

    private var savedWall = 0L
    private var lastSave = 0L

    /** 앱을 켤 때 */
    fun start() {
        val o = try { if (file.exists()) JSONObject(file.readText()) else null } catch (e: Exception) { null }
        savedWall = o?.optLong("wall") ?: 0L
        if (o != null && o.optString("boot") == bootId()) { offset = o.optLong("offset"); valid = true; save() }
        else check()
    }

    /** 폰·PC가 지금 시각을 보냈을 때 */
    fun set(epochMs: Long) { offset = epochMs - sys(); valid = true; save() }

    /** 1초마다: 아직 모르면 보드 시계가 인터넷 시간으로 맞춰졌는지 보고, 알면 1분마다 남긴다. 바뀌었으면 true */
    fun check(): Boolean {
        if (valid) { if (sys() - lastSave > 60_000) save(); return false }
        if (autoTime() && sys() >= maxOf(MIN_SANE, savedWall + 2 * 60_000)) { offset = 0; valid = true; save(); return true }
        return false
    }

    private fun save() {
        lastSave = sys(); savedWall = now()
        try {
            val tmp = File(file.path + ".tmp")
            tmp.writeText(JSONObject().put("offset", offset).put("boot", bootId()).put("wall", savedWall).toString()); tmp.renameTo(file)
        } catch (_: Exception) {}
    }

    companion object { const val MIN_SANE = 1_793_491_200_000L } // 2026-11-01 00:00 KST: 이보다 이르면 보드 시계를 믿지 않는다
}
