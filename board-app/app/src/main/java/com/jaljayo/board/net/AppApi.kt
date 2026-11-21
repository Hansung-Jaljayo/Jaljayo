package com.jaljayo.board.net

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Part
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Reservation
import com.jaljayo.board.brain.Rules
import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit

// 폰 앱의 요청을 처리하고, 폰에 보낼 상태를 만든다. 형식은 docs/interfaces/board-link.md
// 11/19: bed-find·bed-register는 병원 침대 목록(HospitalBeds)이 답한다(가정용 답도 그쪽에 옮김)
// 11/14: 소리 크기·상체 올림은 알람 장부(AlarmItem)에 넣어 울릴 때 쓴다.
// 이번만 바꾼 회차(exc의 시각·종류)는 말로 "이번만" 바꾼 것과 같게, 원래 알람은 그날 건너뛰고 그날 한 번 울리는 알람(parent=원래 번호)을 만든다.
// 그 알람은 폰 목록에 따로 보이지 않고, 폰에는 원래 알람의 exc로 돌려준다. exc와 잠시 끄기 일수(pauseDays)는 extras에 보관한다(exc는 날짜로)
class AppApi {
    data class Result(val state: BedState, val reply: JSONObject?, val extras: Map<Int, JSONObject>)

    private fun ok() = JSONObject().put("ok", true)
    private fun no(why: String) = JSONObject().put("ok", false).put("reason", why)

    /** name을 처리한다. 보드에 없는 기능이면 reply가 null이다(폰은 5초 뒤 실패로 처리)
     *  alarmsAllowed: 11/19 병원 설정에서 알람 쓰기를 끈 병원이면 false. 알람을 새로 만들거나 고치는 요청을 받지 않는다(켜고 끄기·지우기는 받음) */
    fun handle(s: BedState, name: String, body: JSONObject?, today: LocalDate, extras: Map<Int, JSONObject>, alarmsAllowed: Boolean = true): Result {
        fun done(ns: BedState, r: JSONObject = ok(), ex: Map<Int, JSONObject> = extras) = Result(ns, r, ex)
        fun refuse(why: String) = Result(s, no(why), extras)
        return when (name) {
            "bed-move" -> {
                if (s.ringing != null) return refuse(RINGING)
                val b = body ?: return refuse(BAD)
                val t = Angles(b.getDouble("head").coerceIn(0.0, Rules.LIMIT[Part.HEAD]), b.getDouble("leg").coerceIn(0.0, Rules.LIMIT[Part.LEG]))
                done(s.copy(undo = s.target to s.purpose, moveStart = s.angles, target = t, purpose = null, after = "", pending = null, lastMoveWasTarget = true))
            }
            "bed-stop" -> done(s.copy(target = s.angles, after = "", pending = null))
            "pose-save" -> {
                val b = body ?: return refuse(BAD)
                val p = Purpose.of(b.getString("preset")) ?: return refuse(BAD)
                done(s.copy(memory = s.memory + (p to Angles(b.getDouble("head"), b.getDouble("leg"))), prevMemory = s.prevMemory + (p to s.memory[p])))
            }
            "pose-delete" -> {
                val p = body?.let { Purpose.of(it.getString("preset")) } ?: return refuse(BAD)
                done(s.copy(memory = s.memory - p, prevMemory = s.prevMemory + (p to s.memory[p])))
            }
            "alarm-delete" -> {
                val id = body?.getInt("id") ?: return refuse(BAD)
                if (s.ringing?.id == id) return refuse(RINGING)
                done(s.copy(alarms = s.alarms.filter { it.id != id && it.parent != id }), ex = extras - id)
            }
            "alarm-save" -> {
                val b = body ?: return refuse(BAD)
                if (!alarmsAllowed && !b.isNull("draft") && b.has("draft")) return refuse(NO_ALARM)
                alarmSave(s, b, today, extras)
            }
            "resv-save" -> {
                if (!s.timeValid) return refuse(NO_CLOCK)
                val b = body ?: return refuse(BAD)
                val time = LocalTime.ofSecondOfDay(b.getInt("time") * 60L)
                val at = today.plusDays(b.getLong("off")).atTime(time).atZone(KST).toInstant().toEpochMilli()
                val named = if (b.isNull("purpose")) null else Purpose.of(b.getString("purpose"))
                val t = Angles(b.getDouble("head"), b.getDouble("leg"))
                // 보드 장부의 예약에는 자세가 꼭 있어야 해서, 각도만 정한 예약은 FLAT으로 두고 이름으로 구분한다(appReservation)
                // 11/11: 이름은 말로 건 예약과 같은 한글 시각만 둔다(자세는 대답할 때 desc()가 붙인다). 각도만 정한 예약은 angleOnly로 구분
                val label = Brain.resvLabel(today.plusDays(b.getLong("off")).atTime(time), today)
                done(s.copy(reservation = Reservation(at, label, named ?: Purpose.FLAT, t, angleOnly = named == null)))
            }
            "resv-cancel" -> done(s.copy(reservation = null))
            "bed-reset" -> {
                if (s.ringing != null) return refuse(RINGING)
                done(s.copy(alarms = emptyList(), reservation = null, memory = emptyMap(), prevMemory = emptyMap()), ex = emptyMap())
            }
            else -> Result(s, null, extras)
        }
    }

    private fun alarmSave(s: BedState, b: JSONObject, today: LocalDate, extras: Map<Int, JSONObject>): Result {
        val id = if (b.isNull("id")) null else b.getInt("id")
        if (id != null && s.ringing?.id == id) return Result(s, no(RINGING), extras)
        val cur = id?.let { i -> s.alarms.firstOrNull { it.id == i } }
        if (id != null && cur == null) return Result(s, no(BAD), extras)
        var ex = extras
        var kids = s.alarms.filter { it.parent != null && it.parent == id }   // 이 알람의 이번만 회차
        var item: AlarmItem = if (b.isNull("draft")) {
            // 켜고 끄기만(이번만 회차도 함께)
            kids = kids.map { it.copy(enabled = b.getBoolean("on")) }
            cur!!.copy(enabled = b.getBoolean("on"))
        } else {
            val d = b.getJSONObject("draft")
            val newId = id ?: ((s.alarms.maxOfOrNull { it.id } ?: 0) + 1)
            val exc = d.optJSONObject("exc") ?: JSONObject()
            // exc 열쇠는 폰이 보낸 오늘부터의 일수다. 날이 지나도 맞도록 날짜로 바꿔 보관한다
            val excAt = JSONObject().also { o -> exc.keys().forEach { k -> o.put(today.plusDays(k.toLong()).toString(), exc.getJSONObject(k)) } }
            ex = ex + (newId to JSONObject().put("pauseDays", d.opt("pauseDays") ?: JSONObject.NULL).put("exc", excAt))
            var it0 = draftToItem(newId, d, today, cur)
            // 이번만 회차를 다시 만든다(반복 알람일 때만. 한 번 알람은 폰이 exc를 지운다)
            kids = emptyList()
            if (it0.repeating) {
                var next = (s.alarms.maxOfOrNull { it.id } ?: 0).coerceAtLeast(newId) + 1
                for (k in exc.keys()) {
                    val e = exc.getJSONObject(k)
                    if (e.optBoolean("drop")) continue
                    val day = today.plusDays(k.toLong())
                    val way = e.getString("way")
                    it0 = it0.copy(skips = it0.skips + day)
                    kids = kids + AlarmItem(id = next++, time = LocalTime.ofSecondOfDay(e.getInt("time") * 60L), onceDate = day,
                        type = wayType(way), level = if (way == "q2") 2 else 1, enabled = it0.enabled, volume = it0.volume, lift = it0.lift, parent = newId)
                }
            }
            it0
        }
        var others = s.alarms.filter { it.id != item.id && it.parent != item.id }
        // 겹쳐서 덮어쓰는 알람: 한 번 알람은 지우고, 반복 알람은 새 알람이 울리는 날만 건너뛴다
        b.optJSONArray("overwrite")?.let { arr ->
            val over = (0 until arr.length()).map { arr.getInt(it) }.toSet()
            val day = item.onceDate ?: today
            others = others.mapNotNull { a -> if (a.id !in over) a else if (a.repeating) a.copy(skips = a.skips + day) else null }
            ex = ex - over.filter { i -> others.none { it.id == i } }.toSet()
        }
        // 원래 알람이 지워졌으면 그 이번만 회차도 지운다
        val all = others + item + kids
        val kept = all.filter { a -> a.parent == null || all.any { it.id == a.parent && it.parent == null } }
        return Result(s.copy(alarms = kept.sortedBy { it.id }), ok().put("alarmId", item.id), ex)
    }

    private fun wayType(way: String) = when (way) { "q1", "q2" -> "question"; else -> way }

    private fun draftToItem(id: Int, d: JSONObject, today: LocalDate, cur: AlarmItem?): AlarmItem {
        val days = d.getJSONArray("days").let { a -> (0 until a.length()).map { dayOf(a.getInt(it)) }.toSet() }
        val way = d.getString("way")
        fun off(k: String): LocalDate? = if (d.isNull(k)) null else today.plusDays(d.getLong(k))
        // 날짜별 예외 중 "그날 울리지 않음"만 보드가 지킨다
        val drops = d.optJSONObject("exc")?.let { e -> e.keys().asSequence().filter { e.getJSONObject(it).optBoolean("drop") }.map { today.plusDays(it.toLong()) }.toSet() } ?: emptySet()
        val pause = off("pauseTo")
        return AlarmItem(
            id = id,
            time = LocalTime.ofSecondOfDay(d.getInt("time") * 60L),
            days = days,
            onceDate = if (days.isEmpty()) off("dateOff") ?: today else null,
            type = wayType(way),
            level = if (way == "q2") 2 else 1,
            enabled = cur?.enabled ?: true,
            skips = setOfNotNull(off("skipOff")) + drops,
            offFrom = pause?.let { today },
            offUntil = pause,
            lastFired = null,
            volume = d.optInt("volume", 2).coerceIn(1, 3),
            lift = d.optBoolean("lift", false),
        )
    }

    /** 폰에 보낼 상태 */
    fun appState(s: BedState, today: LocalDate, extras: Map<Int, JSONObject>, nowMs: Long): JSONObject {
        fun ang(a: Angles) = JSONObject().put("head", round(a.head)).put("leg", round(a.leg))
        val presets = JSONObject()
        for (p in listOf(Purpose.READ, Purpose.TV, Purpose.REST, Purpose.SLEEP)) presets.put(p.code, s.memory[p]?.let(::ang) ?: JSONObject.NULL)
        return JSONObject().put("type", "app-state")
            .put("angles", ang(s.angles)).put("target", ang(s.target)).put("moving", s.moving)
            .put("clockOk", s.timeValid).put("ringingId", s.ringing?.id ?: JSONObject.NULL)
            .put("alarms", JSONArray(s.alarms.filter { it.parent == null }.map { a -> appAlarm(a, today, extras[a.id], s.alarms.filter { it.parent == a.id }.mapNotNull { it.onceDate }.toSet()) }))
            .put("resv", s.reservation?.let { appReservation(it, nowMs) } ?: JSONObject.NULL)
            .put("presets", presets)
    }

    private fun appAlarm(a: AlarmItem, today: LocalDate, ex: JSONObject?, moved: Set<LocalDate>): JSONObject {
        fun off(d: LocalDate?): Any = d?.let { ChronoUnit.DAYS.between(today, it) } ?: JSONObject.NULL
        val way = if (a.type == "question") (if (a.level == 2) "q2" else "q1") else a.type
        // 날짜로 보관한 exc를 오늘부터의 일수로 돌려준다(지난 날은 뺌). 11/14 전에 일수로 보관한 것은 그대로
        val excSaved = ex?.optJSONObject("exc") ?: JSONObject()
        val exc = JSONObject()
        val excDays = mutableSetOf<LocalDate>()
        for (k in excSaved.keys()) {
            if (!k.contains('-')) { exc.put(k, excSaved.get(k)); continue }
            val d = LocalDate.parse(k); excDays += d
            if (!d.isBefore(today)) exc.put(ChronoUnit.DAYS.between(today, d).toString(), excSaved.get(k))
        }
        // 이번만 회차·그날 안 울림 때문에 넣은 건너뛰기는 "다음 한 번 건너뛰기"로 보이지 않게 뺀다
        val future = a.skips.filter { !it.isBefore(today) && it !in moved && it !in excDays }.minOrNull()
        return JSONObject().put("id", a.id).put("on", a.enabled)
            .put("time", a.time.hour * 60 + a.time.minute)
            .put("days", JSONArray(a.days.map { it.value % 7 }.sorted()))
            .put("dateOff", off(a.onceDate)).put("way", way)
            .put("volume", a.volume).put("lift", a.lift)
            .put("skipOff", off(future)).put("pauseTo", off(a.offUntil))
            .put("pauseDays", ex?.opt("pauseDays") ?: JSONObject.NULL)
            .put("exc", exc)
    }

    private fun appReservation(r: Reservation, nowMs: Long): JSONObject {
        val at = java.time.Instant.ofEpochMilli(r.atMs).atZone(KST)
        val today = java.time.Instant.ofEpochMilli(nowMs).atZone(KST).toLocalDate()
        val named = !r.angleOnly
        return JSONObject().put("time", at.hour * 60 + at.minute).put("off", ChronoUnit.DAYS.between(today, at.toLocalDate()))
            .put("purpose", if (named) r.purpose.code else JSONObject.NULL).put("head", r.target.head).put("leg", r.target.leg)
    }

    private fun round(v: Double) = Math.round(v * 10) / 10.0
    private fun dayOf(i: Int): DayOfWeek = if (i == 0) DayOfWeek.SUNDAY else DayOfWeek.of(i)
    companion object {
        const val RINGING = "알람이 울리는 중이에요"
        const val NO_CLOCK = "침대가 지금 시각을 몰라요"
        const val BAD = "잘못된 요청이에요"
        // 11/19: 병원 설정에서 알람 쓰기를 끈 병원. 말로 알람을 맞추려 할 때도 이 문장으로 대답한다
        const val NO_ALARM = "이 병원에서는 알람을 쓰지 않아요"
    }
}
