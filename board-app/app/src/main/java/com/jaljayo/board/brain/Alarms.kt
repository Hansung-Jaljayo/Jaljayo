package com.jaljayo.board.brain

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

// 알람 장부: 알람을 저장하고, 다음에 울릴 때를 계산하고, 말로 가리킨 알람(대상)을 찾는다.
// 시각은 보드 시계가 틀릴 수 있어 PC·폰에서 맞춘 시각(clock)을 쓴다. 시간대는 한국.
val KST: ZoneId = ZoneId.of("Asia/Seoul")

data class AlarmItem(
    val id: Int,
    val time: LocalTime,
    val days: Set<DayOfWeek> = emptySet(),   // 비었으면 한 번만
    val onceDate: LocalDate? = null,         // 한 번만 울리는 날
    val type: String = "basic",              // basic, question(덧셈 문제), leave_bed(침대에서 나와야 꺼짐)
    val level: Int = 1,                      // 덧셈 자릿수
    val enabled: Boolean = true,
    val skips: Set<LocalDate> = emptySet(),  // 그날만 건너뛰기
    val offFrom: LocalDate? = null,          // 기간 동안 끄기
    val offUntil: LocalDate? = null,
    val lastFired: LocalDateTime? = null,
) {
    val repeating get() = days.isNotEmpty()

    fun ringsOn(d: LocalDate): Boolean {
        if (!enabled || d in skips) return false
        if (offFrom != null && offUntil != null && !d.isBefore(offFrom) && !d.isAfter(offUntil)) return false
        return if (repeating) d.dayOfWeek in days else d == onceDate
    }

    /** now 이후 처음 울릴 때 */
    fun next(now: LocalDateTime): LocalDateTime? {
        var d = now.toLocalDate()
        repeat(400) {
            val at = d.atTime(time)
            if (at.isAfter(now) && ringsOn(d) && (lastFired == null || at.isAfter(lastFired))) return at
            d = d.plusDays(1)
        }
        return null
    }

    fun daysKo(): String = when {
        !repeating -> ""
        days.size == 7 -> "매일"
        days == WEEKDAYS -> "평일"
        days == WEEKEND -> "주말"
        else -> days.sorted().joinToString("·") { DAY_KO.getValue(it) } + "요일"
    }

    fun label(now: LocalDateTime): String {
        val head = if (repeating) daysKo() else onceDate?.let { dateKo(it, now.toLocalDate()) } ?: ""
        return listOf(head, timeKo(time)).filter { it.isNotEmpty() }.joinToString(" ")
    }

    companion object {
        val WEEKDAYS = setOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY)
        val WEEKEND = setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)
        val DAY_CODE = mapOf("mon" to DayOfWeek.MONDAY, "tue" to DayOfWeek.TUESDAY, "wed" to DayOfWeek.WEDNESDAY, "thu" to DayOfWeek.THURSDAY,
            "fri" to DayOfWeek.FRIDAY, "sat" to DayOfWeek.SATURDAY, "sun" to DayOfWeek.SUNDAY)
        val DAY_KO = mapOf(DayOfWeek.MONDAY to "월", DayOfWeek.TUESDAY to "화", DayOfWeek.WEDNESDAY to "수", DayOfWeek.THURSDAY to "목",
            DayOfWeek.FRIDAY to "금", DayOfWeek.SATURDAY to "토", DayOfWeek.SUNDAY to "일")

        fun days(code: String): Set<DayOfWeek> = when (code) {
            "none" -> emptySet(); "daily" -> DayOfWeek.entries.toSet(); "weekdays" -> WEEKDAYS; "weekend" -> WEEKEND
            else -> code.split("+").mapNotNull { DAY_CODE[it] }.toSet()
        }

        fun timeKo(t: LocalTime): String {
            val ap = if (t.hour < 12) "오전" else "오후"
            return "$ap ${Brain.clockKo("%02d:%02d".format(t.hour, t.minute))}"
        }

        fun dateKo(d: LocalDate, today: LocalDate): String = when (ChronoUnit.DAYS.between(today, d)) {
            0L -> "오늘"; 1L -> "내일"; 2L -> "모레"
            else -> "${d.monthValue}월 ${d.dayOfMonth}일".let { s -> s.replace(Regex("\\d+")) { Brain.sino(it.value.toInt()) } }
        }

        /** 말한 날짜 값(today, tomorrow, +2, days_N, 요일, next_요일)을 실제 날짜로 */
        fun date(code: String, today: LocalDate): LocalDate? = when {
            code == "none" -> null
            code == "today" -> today
            code == "tomorrow" -> today.plusDays(1)
            code == "+2" -> today.plusDays(2)
            code.startsWith("days_") -> today.plusDays(code.drop(5).toLong())
            code.startsWith("next_") -> DAY_CODE[code.drop(5)]?.let { d -> today.with(java.time.temporal.TemporalAdjusters.next(DayOfWeek.MONDAY)).let { mon -> mon.plusDays((d.value - 1).toLong()) } }
            code in DAY_CODE -> DAY_CODE[code]?.let { d -> today.with(java.time.temporal.TemporalAdjusters.nextOrSame(d)) }
            else -> null
        }
    }
}

object AlarmFinder {
    /** 하루 중 때: am=0~11시, pm=12~23시, dawn(새벽)=0~5시, morning(아침)=6~11시(11/09 이도 님 결정) */
    fun inDayPart(hour: Int, ap: String): Boolean = when (ap) { "am" -> hour < 12; "pm" -> hour >= 12; "dawn" -> hour in 0..5; "morning" -> hour in 6..11; else -> true }
    /** 말로 가리킨 조건에 맞는 알람들. 조건이 하나도 없으면 null(앞 대화의 알람을 쓰거나 물어봐야 함) */
    fun find(alarms: List<AlarmItem>, c: Command, today: LocalDate, includeOff: Boolean = true): List<AlarmItem>? {
        val target = c["target"]; val ampm = c["target_ampm"]; val days = c["target_days"]; val type = c["target_type"]
        val date = c["date"]; val order = c["target_order"]
        if (listOf(target, ampm, days, type, order).all { it == "none" } && (date == "none" || c.command in setOf("set"))) return null
        var xs = alarms.filter { includeOff || it.enabled }
        if (target != "none" && target != "all") {
            val h = target.take(2).toInt(); val m = target.takeLast(2).toInt()
            // 13시 이상·0시·24시는 24시간제로 분명하므로 그 시각만 찾는다(오후 1시 알람을 01:00으로 고르지 않음)
            val hours = if (h == 0 || h >= 13) setOf(h % 24) else when (ampm) { "am", "dawn", "morning" -> setOf(h % 12); "pm" -> setOf(h % 12 + 12); else -> setOf(h % 24, (h + 12) % 24) }
            xs = xs.filter { it.time.hour in hours && it.time.minute == m }
        } else if (ampm != "none") xs = xs.filter { inDayPart(it.time.hour, ampm) }
        if (days != "none") { val want = AlarmItem.days(days); xs = xs.filter { it.days == want || (want.size == 1 && want.first() in it.days) } }
        if (type != "none") xs = xs.filter { it.type == type }
        val d = AlarmItem.date(date, today)
        // 바꾸기(시각·종류·난이도)의 날짜는 범위가 그날만이거나 아직 정해지지 않았으면 바꿀 회차의 날로 쓴다(그날 울리지 않는 알람은 바꾸지 않고 알림).
        // 범위가 계속(always)이면 날짜는 어느 알람인지 가리키는 말이라, 다른 명령처럼 그날 울리는 알람으로 고른다(11/04 결정표 R8: "내일 알람 앞으로 계속 두 자리로")
        if (d != null && (c.command !in setOf("change_time", "change_type", "change_level") || c["scope"] == "always")) xs = xs.filter { it.repeating && d.dayOfWeek in it.days || it.onceDate == d }
        if (order != "none") xs = if (order == "last") xs.takeLast(1) else xs.drop(order.drop(6).toInt() - 1).take(1)
        return xs
    }

    fun nowLocal(ms: Long): LocalDateTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), KST)
}
