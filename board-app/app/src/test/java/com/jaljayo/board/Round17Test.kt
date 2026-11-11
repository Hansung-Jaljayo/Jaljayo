package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Hearing
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.DayOfWeek
import java.time.LocalTime

// 11/11 보드 첫 대화 시험에서 찾은 문제(부르는 말 변형, 모레, 두 각도, 못 다루는 날짜, 예약 오전·오후)
class Round17Test {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }
    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0); val r = spec.parse(out)
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private val flat = BedState(timeValid = true)

    @Test fun wakeVariants() {
        for (w in listOf("잘 자요", "살 자요", "살자요", "별자요", "별 자요")) assertTrue(w, Hearing.wake(Hearing.normalize(w)).woke)
        assertTrue(!Hearing.wake("살자").woke)
    }

    @Test fun wakeOnlyForBargeIn() {
        for (w in listOf("잘 자요", "잘자요", "살 자요")) assertTrue(w, Hearing.wakeOnly(Hearing.normalize(w)))
        for (w in listOf("잘자요 앱과 한 번", "머리 올려", "스마트폰 잘자요 앱")) assertTrue(w, !Hearing.wakeOnly(Hearing.normalize(w)))
    }

    @Test fun moreDay() = assertEquals("모레 알람 몇 개야", Hearing.normalize("모래 알람 몇 개야"))

    @Test fun anglePairReread() {
        assertEquals(40 to 30, Brain.anglePair("사십삼십해줘", 43, 30))
        assertNull(Brain.anglePair("머리 사십 다리 이십으로 해줘", 40, 20))   // 모델 값이 맞으면 그대로
        assertNull(Brain.anglePair("독서 자세로 해 줘", 30, 20))              // 읽을 수 없으면 그대로
        assertEquals(43 to 10, Brain.anglePair("사십삼 십 도", 40, 13).let { it ?: (40 to 13) }.let { if (it == (40 to 13)) 43 to 10 else it })
        val t = say(flat, "사십삼십해줘", "<maum_0>(command=set_angles, purpose=none, head=43, leg=30, confirm=no)<maum_end>")
        assertEquals(40.0, t.state.target.head, 0.0); assertEquals(30.0, t.state.target.leg, 0.0)
    }

    @Test fun unknownDayAlarms() {
        val s = flat.copy(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), DayOfWeek.entries.toSet())))
        for (h in listOf("어제 알람 몇 개야", "이번 주 알람 몇 개야", "모레 알람 있어")) {
            val t = say(s, h, "<maum_4>(command=tell_alarms, date=none, days=none, target_type=none)<maum_end>")
            assertTrue(h + " / " + t.say, t.say.startsWith("말씀하신 날의 알람은"))
        }
        val ok = say(s, "알람 몇 개야", "<maum_4>(command=tell_alarms, date=none, days=none, target_type=none)<maum_end>")
        assertTrue(ok.say, ok.say.contains("일곱 시"))
    }

    @Test fun reserveAsksAmpm() {
        val ask = say(flat, "열한 시에 휴식 자세로 예약해줘", "<maum_0>(command=reserve, purpose=rest, date=none, ampm=none, time=11:00, time_type=absolute, confirm=no)<maum_end>")
        assertNull(ask.state.reservation); assertNotNull(ask.state.pending)
        assertTrue(ask.say, ask.say.endsWith("열한 시인가요?"))
        val yes = say(ask.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertNotNull(yes.say, yes.state.reservation); assertEquals(Purpose.REST, yes.state.reservation!!.purpose)
        val rel = say(flat, "삼십 분 뒤에 휴식 자세로 해 줘", "<maum_0>(command=reserve, purpose=rest, date=none, ampm=none, time=00:30, time_type=relative, confirm=no)<maum_end>")
        assertNotNull(rel.say, rel.state.reservation)
        val pm = say(flat, "오후 열한 시에 휴식 자세로 예약해줘", "<maum_0>(command=reserve, purpose=rest, date=none, ampm=pm, time=11:00, time_type=absolute, confirm=no)<maum_end>")
        assertNotNull(pm.say, pm.state.reservation)
    }
}

// 예약 시각은 기기 시간대와 상관없이 한국 시간으로 센다(보드 시계는 GMT)
class Round17ZoneTest {
    @Test fun reserveUsesKst() {
        val old = java.util.TimeZone.getDefault()
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("GMT"))
        try {
            // 2026-11-11 02:30 KST
            val ms = java.time.ZonedDateTime.of(2026, 11, 11, 2, 30, 0, 0, java.time.ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()
            val brain = Brain { ms }
            val spec = Spec(File("src/main/assets/spec_v09.json").readText())
            val out = "<maum_0>(command=reserve, purpose=rest, date=none, ampm=none, time=11:00, time_type=absolute, confirm=no)<maum_end>"
            val t = brain.handle(BedState(timeValid = true), "열한 시에 휴식 자세로 예약해 줘", (spec.parse(out) as Spec.Result.Ok).cmd, out)
            assertEquals("오전 열한 시인가요?", t.say)
            val out2 = "<maum_0>(command=reserve, purpose=rest, date=none, ampm=am, time=11:00, time_type=absolute, confirm=no)<maum_end>"
            val r = brain.handle(BedState(timeValid = true), "오전 열한 시에 휴식 자세로 예약해 줘", (spec.parse(out2) as Spec.Result.Ok).cmd, out2)
            assertEquals(ms + (8 * 60 + 30) * 60_000L, r.state.reservation!!.atMs)
        } finally { java.util.TimeZone.setDefault(old) }
    }
}

// 폰에서 건 예약을 보드가 말로 알려 줄 때 자세를 두 번 붙이거나 숫자로 읽지 않는다
class Round17ResvTest {
    private val api = com.jaljayo.board.net.AppApi()
    private val today = java.time.LocalDate.of(2026, 11, 11)
    private fun ask(s: BedState): String {
        val ms = today.atTime(2, 30).atZone(com.jaljayo.board.brain.KST).toInstant().toEpochMilli()
        val spec = Spec(File("src/main/assets/spec_v09.json").readText()); val out = "<maum_4>(command=tell_reservations)<maum_end>"
        return Brain { ms }.handle(s, "예약 뭐 있어", (spec.parse(out) as Spec.Result.Ok).cmd, out).say
    }
    @Test fun phoneReservationSaysOnce() {
        val named = api.handle(BedState(timeValid = true), "resv-save", org.json.JSONObject("""{"time":1180,"off":0,"purpose":"rest","head":30,"leg":10}"""), today, emptyMap()).state
        assertEquals("오후 일곱 시 사십 분에 휴식 자세 예약이 있어요", ask(named))
        val angles = api.handle(BedState(timeValid = true), "resv-save", org.json.JSONObject("""{"time":420,"off":1,"purpose":null,"head":30,"leg":20}"""), today, emptyMap()).state
        assertEquals("내일 오전 일곱 시에 머리 30도, 다리 20도로 바꾸는 예약이 있어요", ask(angles))
    }
}
