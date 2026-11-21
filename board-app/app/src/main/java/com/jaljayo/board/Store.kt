package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Reservation
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// 앱이 다시 켜져도 알람·자세 예약·저장 자세가 남도록 파일에 적어 둔다.
// 각도와 움직임은 저장하지 않는다(전원이 다시 들어와도 저절로 움직이지 않게).
class Store(private val file: File) {
    private var last = ""

    fun save(s: BedState) {
        val o = JSONObject()
            .put("alarms", JSONArray(s.alarms.map { a ->
                JSONObject().put("id", a.id).put("time", a.time.toString()).put("days", JSONArray(a.days.map { it.name }))
                    .put("onceDate", a.onceDate?.toString()).put("type", a.type).put("level", a.level).put("enabled", a.enabled)
                    .put("skips", JSONArray(a.skips.map { it.toString() })).put("offFrom", a.offFrom?.toString()).put("offUntil", a.offUntil?.toString())
                    .put("lastFired", a.lastFired?.toString())
                    .put("volume", a.volume).put("lift", a.lift).put("parent", a.parent ?: JSONObject.NULL).put("setAt", a.setAt)
            }))
            .put("reservation", s.reservation?.let { r -> JSONObject().put("atMs", r.atMs).put("label", r.label).put("purpose", r.purpose.code).put("head", r.target.head).put("leg", r.target.leg).put("angleOnly", r.angleOnly)
                .put("adjust", r.adjust?.let { a -> JSONObject().put("part", a.part).put("direction", a.direction).put("amount", a.amount).put("amountType", a.amountType) } ?: JSONObject.NULL) })
            .put("memory", JSONObject(s.memory.mapKeys { it.key.code }.mapValues { JSONArray(listOf(it.value.head, it.value.leg)) }))
            // 자세마다 바로 전에 저장돼 있던 값(11/09). 처음 값이었으면 빈 배열
            .put("prevMemory", JSONObject(s.prevMemory.mapKeys { it.key.code }.mapValues { v -> JSONArray(v.value?.let { listOf(it.head, it.leg) } ?: emptyList<Double>()) }))
            .put("lastCalled", s.lastCalled?.code)
            .put("name", s.name).put("volume", s.volume).put("ward", s.ward)   // 11/12: 침대 이름, 말소리 크기 단계
        val text = o.toString()
        if (text == last) return
        last = text
        val tmp = File(file.path + ".tmp")
        tmp.writeText(text); tmp.renameTo(file)
    }

    fun load(s: BedState): BedState {
        if (!file.exists()) return s
        return try {
            val o = JSONObject(file.readText()).also { last = it.toString() }
            fun str(j: JSONObject, k: String) = if (j.isNull(k)) null else j.getString(k)
            val alarms = o.getJSONArray("alarms").let { arr ->
                (0 until arr.length()).map { i ->
                    val a = arr.getJSONObject(i)
                    AlarmItem(a.getInt("id"), LocalTime.parse(a.getString("time")),
                        a.getJSONArray("days").let { d -> (0 until d.length()).map { DayOfWeek.valueOf(d.getString(it)) }.toSet() },
                        str(a, "onceDate")?.let(LocalDate::parse), a.getString("type"), a.getInt("level"), a.getBoolean("enabled"),
                        a.getJSONArray("skips").let { d -> (0 until d.length()).map { LocalDate.parse(d.getString(it)) }.toSet() },
                        str(a, "offFrom")?.let(LocalDate::parse), str(a, "offUntil")?.let(LocalDate::parse), str(a, "lastFired")?.let(LocalDateTime::parse),
                        a.optInt("volume", 2).coerceIn(1, 3), a.optBoolean("lift", false), if (a.isNull("parent") || !a.has("parent")) null else a.getInt("parent"), a.optLong("setAt", 0L))
                }
            }
            val r = if (o.isNull("reservation")) null else o.getJSONObject("reservation").let {
                // 11/10까지 폰에서 건 예약은 이름이 "오후 7시 40분 휴식 자세"처럼 저장돼 있었다. 숫자가 있으면 한글 시각으로 다시 만든다
                val old = it.getString("label"); val atMs = it.getLong("atMs")
                val angleOnly = it.optBoolean("angleOnly", old.contains("머리 "))
                val label = if (old.any { ch -> ch.isDigit() }) {
                    val at = java.time.LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(atMs), com.jaljayo.board.brain.KST)
                    Brain.resvLabel(at, java.time.LocalDate.now(com.jaljayo.board.brain.KST))
                } else old
                val adj = it.optJSONObject("adjust")?.let { a -> com.jaljayo.board.brain.AdjustPlan(a.getString("part"), a.getString("direction"), a.getString("amount"), a.getString("amountType")) }
                Reservation(atMs, label, Purpose.of(it.getString("purpose"))!!, Angles(it.getDouble("head"), it.getDouble("leg")), angleOnly, adj)
            }
            val mem = o.getJSONObject("memory").let { m -> m.keys().asSequence().associate { k -> Purpose.of(k)!! to m.getJSONArray(k).let { Angles(it.getDouble(0), it.getDouble(1)) } } }
            val prev = if (!o.has("prevMemory")) emptyMap() else o.getJSONObject("prevMemory").let { m -> m.keys().asSequence().associate { k -> Purpose.of(k)!! to m.getJSONArray(k).let { if (it.length() == 0) null else Angles(it.getDouble(0), it.getDouble(1)) } } }
            s.copy(alarms = alarms, reservation = r, memory = mem, prevMemory = prev, lastCalled = str(o, "lastCalled")?.let { Purpose.of(it) },
                name = o.optString("name", s.name).ifBlank { s.name }, volume = o.optInt("volume", s.volume).coerceIn(1, com.jaljayo.board.brain.Rules.VOLUME_MAX), ward = o.optBoolean("ward", false))
        } catch (e: Exception) { s }
    }
}
