package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// 11/04 결정표(R1·R2·R3·R4·R6·R7·R8·R9·R10)의 보드 동작. 기준: 말한 정보는 보존하고, 행동·대상·범위가 불명확하면 바꾸기 전에 묻는다.
// 명확화 질문의 대답은 값을 채울 뿐 실행 동의가 아니다. 시계는 2026-11-04(수) 오전 6시
class DecisionTableTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val nowMs = LocalDateTime.of(2026, 11, 4, 6, 0).atZone(KST).toInstant().toEpochMilli()
    private val brain = Brain { nowMs }
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"
    private val today = LocalDate.of(2026, 11, 4)

    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out)
        assertTrue("규격 위반: $out $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun daily(): BedState = say(BedState(), "매일 오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
    private fun ct(date: String, scope: String, confirm: String = "no") = "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=$date, ampm=none, time=08:00, time_type=absolute, scope=$scope, target_type=none, target_order=none, confirm=$confirm)<maum_end>"

    @Test fun r9EnableOnlyThatDayIsUnsupportedWithItsOwnNotice() {
        val t = say(BedState(), "모레 하루만 일찍 나가야 해서 꺼 둔 여섯 시 알람 그날만 켜 줘", "<maum_3>(reason=out_of_scope)<maum_end>")
        assertEquals("꺼 둔 알람을 특정 날짜에만 켜는 기능은 지원하지 않아요", t.say)
        // 다른 지원 밖 요청은 원래 안내
        assertEquals(Rules.MISHEARD, say(BedState(), "에어컨 켜 줘", "<maum_3>(reason=out_of_scope)<maum_end>").say)
    }

    @Test fun r7KeepAsYouProposedIsConsent() {
        // "머리 조금 올릴까요?"(먼저 묻기) 뒤 "응 그대로 하면 돼"(이제 yes)는 제안을 실행한다
        val a = say(BedState(), "머리 좀 올렸으면 좋겠어", "<maum_0>(command=adjust, part=head, direction=up, amount=small, amount_type=delta, confirm=yes)<maum_end>")
        assertEquals("confirm", a.state.pending?.kind)
        val b = say(a.state, "응 그대로 하면 돼", yes)
        assertTrue(b.state.target.head > 0.0)
        // 유효한 제안이 없으면 동의만으로 행동을 만들지 않는다
        val c = say(BedState(), "응 그대로 하면 돼", yes)
        assertEquals(BedState().target, c.state.target); assertEquals(Rules.WHAT, c.say)
    }

    @Test fun r6NoDirectionAsksUpOrDownAndKeepsAmountAndConsent() {
        val s = BedState(angles = Angles(20.0, 10.0), target = Angles(20.0, 10.0))
        val a = say(s, "다리 좀 움직여 줘", "<maum_0>(command=adjust, part=leg, direction=none, amount=small, amount_type=delta, confirm=no)<maum_end>")
        assertEquals("direction", a.state.pending?.kind); assertEquals(s.target, a.state.target); assertTrue(a.say.contains("올릴까요, 내릴까요"))
        // "내려"는 방향만 채우고 '좀'(5도)을 지킨다
        val b = say(a.state, "내려", "<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none, confirm=no)<maum_end>")
        assertEquals(5.0, b.state.target.leg, 0.01)
        // 원래 요청이 바람(confirm=yes)이면 방향 대답 뒤에도 바로 움직이지 않고 동의를 묻는다
        val c = say(s, "다리 좀 바꿨으면 해", "<maum_0>(command=adjust, part=leg, direction=none, amount=small, amount_type=delta, confirm=yes)<maum_end>")
        assertEquals("direction", c.state.pending?.kind)
        val d = say(c.state, "올려", "<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>")
        assertEquals(s.target, d.state.target); assertEquals("confirm", d.state.pending?.kind)
        assertEquals(15.0, say(d.state, "응", yes).state.target.leg, 0.01)
    }

    @Test fun r1CancelThatRequestStopsOnlyWhenTheMoveCameFromIt() {
        val a = say(BedState(), "머리 올려", "<maum_0>(command=adjust, part=head, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>")
        assertTrue(a.state.moving)
        val cancel = "<maum_2>(command=request, operation=cancel, target=none, date=none, time=none, target_order=none)<maum_end>"
        val b = say(a.state, "하던 요청 그냥 취소할래", cancel)
        assertTrue(!b.state.moving)
        // 사이에 다른 말이 끼어 연결이 불분명하면 멈추지 않고 무엇을 취소할지 묻는다
        val mid = say(a.state, "지금 몇 시야", "<maum_4>(command=tell_time)<maum_end>")
        val c = say(mid.state, "하던 요청 그냥 취소할래", cancel)
        assertTrue(c.state.moving); assertEquals("무엇을 취소할까요?", c.say)
        // 예약은 건드리지 않는다
        val r = say(a.state.copy(angles = a.state.target), "삼십 분 뒤에 잠 자세로 바꿔", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=no)<maum_end>").state
        assertNotNull(say(r, "하던 요청 그냥 취소할래", cancel).state.reservation)
    }

    @Test fun r2BareDurationIsNotANewAlarm() {
        // 묻는 것도 울리는 알람도 없으면 알람을 만들지 않고 무엇을 그만큼 할지 묻는다. '더'는 원문에서 보존
        val a = say(BedState(), "오분만", "<maum_2>(type=duration, value=00:05)<maum_end>")
        assertTrue(a.state.alarms.isEmpty()); assertEquals("무엇을 오 분 할까요?", a.say)
        assertEquals("무엇을 오 분 더 할까요?", say(BedState(), "오분 더", "<maum_2>(type=duration, value=00:05)<maum_end>").say)
        // 울리는 중이면 울리는 알람을 미룬다(최대 30분 규칙 그대로)
        val s = daily().let { it.copy(ringing = it.alarms.first()) }
        val b = say(s, "십 분만", "<maum_2>(type=duration, value=00:10)<maum_end>")
        assertNull(b.state.ringing); assertEquals("십 분 미뤘어요", b.say)
        val c = say(s, "한 시간만", "<maum_2>(type=duration, value=01:00)<maum_end>")
        assertNotNull(c.state.ringing); assertTrue(c.say.contains("삼십 분"))
        // 얼마나 늦출지 묻는 중이면 그 질문에 채운다
        val q = say(daily(), "일곱 시 알람 늦춰", "<maum_1>(command=change_time, target=07:00, target_ampm=none, target_days=none, date=none, ampm=none, time=none, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("amount", q.state.pending?.kind)
        assertEquals(LocalTime.of(7, 10), say(q.state, "십 분만", "<maum_2>(type=duration, value=00:10)<maum_end>").state.alarms.first().time)
    }

    @Test fun r10UnclearStartIsAskedAndAnswerIsNotConsent() {
        val alarm = daily()
        val skip = { c: String -> "<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=none, start=ask, until=none, period=3, target_type=none, target_order=none, confirm=$c)<maum_end>" }
        val a = say(alarm, "내일 출장이라 알람 사흘 꺼", skip("no"))
        assertEquals("skip_start", a.state.pending?.kind); assertEquals("언제부터 꺼 둘까요?", a.say); assertEquals(alarm.alarms, a.state.alarms)
        // 대답은 시작일만 채운다: 직접 요청이면 그 시작일부터 실행
        val b = say(a.state, "내일부터", "<maum_2>(type=date, value=tomorrow)<maum_end>")
        assertTrue(b.state.alarms.first().skips.contains(today.plusDays(1))); assertTrue(!b.state.alarms.first().skips.contains(today))
        // 바람(confirm=yes)이었다면 시작일을 받은 뒤에도 바로 바꾸지 않고 동의를 묻는다
        val c = say(alarm, "내일 출장이라 알람 사흘 꺼 두고 싶어", skip("yes"))
        val d = say(c.state, "내일부터", "<maum_2>(type=date, value=tomorrow)<maum_end>")
        assertEquals(alarm.alarms, d.state.alarms); assertEquals("confirm", d.state.pending?.kind)
    }

    @Test fun r8ScopeIsAskedOnlyWhenADateLeavesItOpen() {
        val s = daily()
        // 날짜만 있고 범위를 말하지 않으면 바꾸기 전에 묻는다
        val a = say(s, "내일 알람 여덟 시로 바꿔", ct("tomorrow", "none"))
        assertEquals("scope", a.state.pending?.kind); assertEquals(s.alarms, a.state.alarms); assertTrue(a.say.contains("만 바꿀까요, 앞으로 계속 바꿀까요"))
        // "이번만" → 그 회차만, "앞으로 계속" → 알람 자체
        val once = say(a.state, "이번만", "<maum_2>(type=scope, value=once)<maum_end>").state
        assertEquals(LocalTime.of(7, 0), once.alarms.first().time); assertTrue(once.alarms.any { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(8, 0) })
        val always = say(a.state, "앞으로 계속", "<maum_2>(type=scope, value=always)<maum_end>").state
        assertEquals(LocalTime.of(8, 0), always.alarms.single().time)
        // 범위를 말했으면 묻지 않는다
        assertEquals(LocalTime.of(8, 0), say(s, "내일 알람 앞으로 여덟 시로", ct("tomorrow", "always")).state.alarms.single().time)
        assertTrue(say(s, "내일만 여덟 시로", ct("tomorrow", "once")).state.alarms.any { it.onceDate == today.plusDays(1) })
        // 한 번만 울리는 알람이면 두 선택의 효과가 같아 묻지 않는다
        val one = say(BedState(), "내일 오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val b = say(one, "내일 알람 여덟 시로 바꿔", ct("tomorrow", "none"))
        assertNull(b.state.pending); assertEquals(LocalTime.of(8, 0), b.state.alarms.single().time)
        // 바람이었다면 범위 대답 뒤에도 동의를 묻는다
        val c = say(s, "내일 알람 여덟 시로 바꾸고 싶어", ct("tomorrow", "none", "yes"))
        val d = say(c.state, "이번만", "<maum_2>(type=scope, value=once)<maum_end>")
        assertEquals(s.alarms, d.state.alarms); assertEquals("confirm", d.state.pending?.kind)
        // 종류 바꾸기의 그날만: 반복 알람은 그날 건너뛰고 그날만 새 종류로 울린다
        val e = say(s, "내일만 덧셈 알람으로", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=tomorrow, type=question, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>").state
        assertEquals("basic", e.alarms.first().type); assertTrue(e.alarms.any { it.onceDate == today.plusDays(1) && it.type == "question" })
        // 난이도는 날짜만 있으면 묻고, 이번만을 고르면 지금처럼 받지 않는다
        val q = say(s, "덧셈 알람으로", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val f = say(q, "내일 알람 난이도 올려", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=up, date=tomorrow, scope=none, target_type=none, target_order=none, context=alarm, confirm=no)<maum_end>")
        assertEquals("scope", f.state.pending?.kind)
        assertEquals("알람 문제 난이도는 날짜를 골라 바꿀 수 없어요", say(f.state, "이번만", "<maum_2>(type=scope, value=once)<maum_end>").say)
    }

    // 코덱스 9차: "이번만"(날짜 없음)과 여러 알람의 그날만 바꾸기. 고른 알람마다 같은 원칙
    private fun withOneShot(s: BedState, time: String = "09:00") = say(s, "내일 알람 맞춰", "<maum_1>(command=set, date=tomorrow, ampm=am, time=$time, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
    @Test fun r8OnceAppliesToEachChosenAlarm() {
        val s = daily()
        // 날짜 없이 "이번만": 다음에 울리는 날(오늘 오전 7시)만 바꾸고 반복 알람은 그대로
        val a = say(s, "알람 이번만 덧셈 알람으로 바꿔 줘", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        val orig = a.state.alarms.first { it.repeating }
        assertEquals("basic", orig.type); assertTrue(today in orig.skips)
        assertTrue(a.state.alarms.any { it.onceDate == today && it.type == "question" && it.time == LocalTime.of(7, 0) }); assertTrue(a.say, a.say.contains("오늘만"))
        val b = say(s, "알람 이번 한 번만 여덟 시로", ct("none", "once"))
        assertEquals(LocalTime.of(7, 0), b.state.alarms.first { it.repeating }.time); assertTrue(b.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(8, 0) })
        // 반복 알람과 한 번만 울리는 알람을 함께 "내일만": 둘 다 바꾼다(반복은 그날만 새로, 한 번짜리는 그 알람을)
        val m = withOneShot(s)
        val all = "target=all, target_ampm=none, target_days=none, date=tomorrow"
        val c = say(m, "내일 알람 다 이번만 여덟 시로", "<maum_1>(command=change_time, $all, ampm=am, time=08:00, time_type=absolute, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(LocalTime.of(7, 0), c.state.alarms.first { it.repeating }.time); assertTrue(today.plusDays(1) in c.state.alarms.first { it.repeating }.skips)
        assertEquals(2, c.state.alarms.count { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(8, 0) }); assertEquals(3, c.state.alarms.size)
        val d = say(m, "내일 알람 다 이번만 덧셈으로", "<maum_1>(command=change_type, $all, type=question, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("question", d.state.alarms.first { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(9, 0) }.type)
        assertTrue(d.state.alarms.any { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(7, 0) && it.type == "question" })
        assertEquals("basic", d.state.alarms.first { it.repeating }.type); assertTrue(d.say, d.say.contains("알람 두 개를 내일만"))
        // 그날 울리지 않는 알람은 바꾸지 않고 그렇다고 알린다(바꿨다고 하지 않음)
        val w = say(m, "주말 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=10:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val e = say(w, "내일 알람 다 이번만 여덟 시로", "<maum_1>(command=change_time, $all, ampm=am, time=08:00, time_type=absolute, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(LocalTime.of(10, 0), e.state.alarms.first { it.days == setOf(java.time.DayOfWeek.SATURDAY, java.time.DayOfWeek.SUNDAY) }.time)
        assertTrue(e.say, e.say.contains("알람 두 개를 내일만") && e.say.contains("내일에 울리지 않아 바꾸지 않았어요"))
        // 여러 반복 알람을 "이번만 삼십 분 당겨": 알람마다 자기 시각에서 당긴다
        val two = say(s, "매일 오전 여덟 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val f = say(two, "알람 다 이번만 삼십 분 당겨", "<maum_1>(command=change_time, target=all, target_ampm=none, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(setOf(LocalTime.of(6, 30), LocalTime.of(7, 30)), f.state.alarms.filter { it.onceDate == today }.map { it.time }.toSet())
        assertTrue(f.say, f.say.contains("삼십 분 당겼어요"))
        // 당기거나 늦춰 자정을 넘으면 날짜도 넘어간다(코덱스 10차). 오늘 밤 11시 반 회차를 한 시간 늦추면 내일 0시 반
        val late = say(BedState(), "매일 밤 열한 시 반 알람", "<maum_1>(command=set, date=none, ampm=pm, time=11:30, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val g = say(late, "알람 이번만 한 시간 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=01:00, time_type=later, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(today in g.state.alarms.first { it.repeating }.skips)
        assertTrue(g.state.alarms.any { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(0, 30) }); assertTrue(g.say, g.say.contains("오늘 오후 열한 시 반 회차를 내일 오전 열두 시 반으로 바꿨어요"))
        // 한 번 울리는 알람도 날짜까지 바뀐다
        val oneLate = say(BedState(), "내일 밤 열한 시 반 알람", "<maum_1>(command=set, date=tomorrow, ampm=pm, time=11:30, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val h = say(oneLate, "알람 이번만 한 시간 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=01:00, time_type=later, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(today.plusDays(2), h.state.alarms.single().onceDate); assertEquals(LocalTime.of(0, 30), h.state.alarms.single().time)
        // 당겨서 자정 전으로 넘어가는 것도 같다. 내일 0시 반 회차를 한 시간 당기면 오늘 밤 11시 반
        val early = say(BedState(), "매일 밤 열두 시 반 알람", "<maum_1>(command=set, date=none, ampm=am, time=12:30, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val i = say(early, "알람 이번만 한 시간 당겨", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=01:00, time_type=earlier, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(today.plusDays(1) in i.state.alarms.first { it.repeating }.skips)
        assertTrue(i.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(23, 30) })
    }

    // 코덱스 11차: 바꾼 결과가 지금이거나 이미 지났으면 그 알람은 그대로 두고(시각·날짜·건너뛰기) 이유를 알린다. 안내는 바꾼 방식부터 가른다
    private fun sayAt(h: Int, m: Int, s: BedState, heard: String, out0: String): Turn {
        val b = Brain { LocalDateTime.of(2026, 11, 4, h, m).atZone(KST).toInstant().toEpochMilli() }
        val out = Spec.upgrade(out0); val r = spec.parse(out)
        assertTrue("규격 위반: $out $r", r is Spec.Result.Ok)
        return b.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun earlier(min: String) = "<maum_1>(command=change_time, target=all, target_ampm=none, target_days=none, date=none, ampm=none, time=$min, time_type=earlier, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>"
    @Test fun r8OnceNeverMovesIntoThePast() {
        val rep = daily()  // 매일 오전 7시
        val one = say(BedState(), "오늘 오전 일곱 시 알람", "<maum_1>(command=set, date=today, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        for (base in listOf(rep, one)) {
            // 지금 오전 6시 50분. 30분 당기면 지난 시각, 10분 당기면 지금과 같음 → 바꾸지 않음
            for (min in listOf("00:30", "00:10")) {
                val r = sayAt(6, 50, base, "이번만 당겨", earlier(min))
                assertEquals(base.alarms, r.state.alarms); assertTrue(r.say, r.say.contains("바꾸면 이미 지난 시각이라 바꾸지 않았어요"))
            }
            // 5분 당기면 미래 → 바꿈
            val r = sayAt(6, 50, base, "이번만 오 분 당겨", earlier("00:05"))
            assertTrue(r.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(6, 55) })
            if (base === rep) assertTrue(today in r.state.alarms.first { it.repeating }.skips) else assertEquals(1, r.state.alarms.size)
        }
        // 여러 대상 중 일부만 지난 시각: 가능한 것만 바꾸고, 뺀 알람은 원래대로 두고 알린다
        val two = say(rep, "매일 오전 여덟 시 알람", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val a = sayAt(6, 50, two, "알람 다 이번만 삼십 분 당겨", earlier("00:30"))
        val seven = a.state.alarms.first { it.repeating && it.time == LocalTime.of(7, 0) }
        assertEquals(two.alarms.first { it.time == LocalTime.of(7, 0) }, seven)
        assertTrue(today in a.state.alarms.first { it.repeating && it.time == LocalTime.of(8, 0) }.skips)
        assertTrue(a.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(7, 30) }); assertEquals(3, a.state.alarms.size)
        assertTrue(a.say, a.say.contains("오늘만 오전 일곱 시 반으로 바꿨어요") && a.say.contains("바꾸면 이미 지난 시각이라 바꾸지 않았어요"))
        // 날짜를 말했는데 그 회차가 이미 지났으면 바꾸지 않는다(오전 9시에 "오늘만 열 시로")
        val g = sayAt(9, 0, rep, "오늘만 열 시로", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=today, ampm=am, time=10:00, time_type=absolute, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(rep.alarms, g.state.alarms); assertTrue(g.say, g.say.contains("그 회차가 이미 지나 바꾸지 않았어요"))
        // 다음 회차 날짜가 다른 알람들을 같은 시각으로: "늦췄어요"가 아니라 각 회차를 그 시각으로 바꿨다고 말한다
        val w = say(rep, "주말 오전 열 시 알람", "<maum_1>(command=set, date=none, ampm=am, time=10:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val b = say(w, "알람 다 이번만 여덟 시로", "<maum_1>(command=change_time, target=all, target_ampm=none, target_days=none, date=none, ampm=am, time=08:00, time_type=absolute, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(b.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(8, 0) })
        assertTrue(b.state.alarms.any { it.onceDate == LocalDate.of(2026, 11, 7) && it.time == LocalTime.of(8, 0) })
        assertTrue(b.say, b.say.contains("알람 두 개를 각각 다음 회차만 오전 여덟 시로 바꿨어요") && !b.say.contains("늦췄") && !b.say.contains("당겼"))
        // 여러 알람을 늦추는데 일부만 자정을 넘음: 바꾼 양으로 말하고, 날짜가 바뀐 알람이 있다고 덧붙인다
        val late = say(rep, "매일 밤 열한 시 반 알람", "<maum_1>(command=set, date=none, ampm=pm, time=11:30, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        val c = say(late, "알람 다 이번만 한 시간 늦춰", "<maum_1>(command=change_time, target=all, target_ampm=none, target_days=none, date=none, ampm=none, time=01:00, time_type=later, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(c.state.alarms.any { it.onceDate == today && it.time == LocalTime.of(8, 0) })
        assertTrue(c.state.alarms.any { it.onceDate == today.plusDays(1) && it.time == LocalTime.of(0, 30) })
        assertTrue(c.say, c.say.contains("알람 두 개를 오늘만 한 시간 늦췄어요. 날짜가 바뀐 알람도 있어요"))
    }

    // 범위가 계속이면 날짜는 대상을 가리킨다: 그날 울리는 알람만 골라 알람 자체를 바꾼다(묻지 않음). 시각·난이도 모두
    @Test fun r8AlwaysWithDatePicksTheAlarmOfThatDay() {
        var s = say(BedState(), "평일 오전 일곱 시 덧셈 알람", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=question, repeat=weekly, days=weekdays, confirm=no)<maum_end>").state
        s = say(s, "주말 오전 아홉 시 덧셈 알람", "<maum_1>(command=set, date=none, ampm=am, time=09:00, time_type=absolute, type=question, repeat=weekly, days=weekend, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
        // 오늘은 수요일. "내일(목) 알람 문제 앞으로 계속 두 자리로" → 평일 알람만
        val a = say(s, "내일 울리는 알람 문제 앞으로 계속 두 자리로 해 줘", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=two, date=tomorrow, scope=always, target_type=question, target_order=none, context=alarm, confirm=no)<maum_end>")
        assertNull(a.state.pending); assertEquals(mapOf(7 to 2, 9 to 1), a.state.alarms.associate { it.time.hour to it.level })
        // "이번 토요일 알람 앞으로 여덟 시로" → 주말 알람 자체를 바꾸고 평일 알람은 그대로, 새 알람 없음
        val b = say(s, "이번 토요일 알람 앞으로 여덟 시로", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=sat, ampm=am, time=08:00, time_type=absolute, scope=always, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertNull(b.state.pending); assertEquals(setOf(7, 8), b.state.alarms.map { it.time.hour }.toSet()); assertEquals(2, b.state.alarms.size)
        assertTrue(b.state.alarms.first { it.time.hour == 8 }.days.contains(java.time.DayOfWeek.SATURDAY))
        // 바람이면 대상을 고른 뒤 동의를 묻는다
        val c = say(s, "내일 알람 문제 앞으로는 어려운 걸로 됐으면 좋겠어", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=up, date=tomorrow, scope=always, target_type=question, target_order=none, context=alarm, confirm=yes)<maum_end>")
        assertEquals("confirm", c.state.pending?.kind); assertEquals(s.alarms, c.state.alarms)
    }

    // 11/04(코덱스 16차): "이번 주만 알람 꺼 둬 주말 빼고"(until=fri, 직접 명령). 주중에는 금요일까지 끄고, 주말에 말하면 다음 주로 넘기지 않고 안내한다
    @Test fun skipThisWeekExceptWeekendDoesNotSpillIntoNextWeek() {
        val out = "<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=none, start=none, until=fri, period=none, target_type=none, target_order=none, confirm=no)<maum_end>"
        fun on(day: LocalDate, s: BedState, heard: String): Turn {
            val b = Brain { day.atTime(6, 0).atZone(KST).toInstant().toEpochMilli() }
            val r = spec.parse(out); assertTrue(r is Spec.Result.Ok)
            return b.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
        }
        val s = daily()
        // 수요일: 오늘부터 금요일까지 끈다(다음 주 월요일부터 원래대로)
        val wed = on(today, s, "이번 주만 알람 꺼 둬 주말 빼고")
        val a = wed.state.alarms.single()
        assertTrue(wed.say, a.offUntil == today.plusDays(2) || (today.plusDays(2) in a.skips))
        // 토요일: 이번 주 금요일이 지났으니 바꾸지 않고 안내한다(다음 주 금요일까지 끄지 않음)
        val sat = on(LocalDate.of(2026, 11, 7), s, "이번 주만 알람 꺼 둬 주말 빼고")
        assertEquals(s.alarms, sat.state.alarms); assertTrue(sat.say, sat.say.contains("이번 주 금요일은 이미 지나서"))
        // '이번 주'가 없는 "금요일까지 꺼 줘"는 토요일에도 다가오는 금요일까지다(지금 동작 그대로)
        val sat2 = on(LocalDate.of(2026, 11, 7), s, "금요일까지 알람 꺼 줘")
        assertTrue(sat2.say, sat2.state.alarms != s.alarms)
    }

    // 11/09 이도 님 결정: 저장값 되돌리기는 침대 이동과 상관없다. 예전 모델의 object=unclear도 처음 값 되돌리기로 받아 늘 한 번 묻고, 침대는 움직이지 않는다
    @Test fun resetNeverAsksToMoveBed() {
        val s = BedState(angles = Angles(10.0, 5.0), target = Angles(10.0, 5.0), memory = mapOf(Purpose.SLEEP to Angles(12.0, 8.0)))
        val a = say(s, "잠 자세 처음 상태로 돌려 놔", "<maum_0>(command=reset_default, purpose=sleep, object=unclear, confirm=no)<maum_end>")
        assertEquals("reset", a.state.pending?.kind); assertEquals(s.target, a.state.target); assertEquals(s.memory, a.state.memory)
        assertEquals("잠 자세의 저장 각도를 처음 값으로 되돌릴까요?", a.say)
        val y = say(a.state, "응", yes)
        assertEquals(s.target, y.state.target); assertNull(y.state.memory[Purpose.SLEEP])
    }

    // 11/09: 직전 값으로 되돌리기. 자세마다 바로 전에 저장돼 있던 값 하나를 남기고, 묻고 나서 그 값으로 되돌린다
    @Test fun resetToPreviousValue() {
        val s = BedState(angles = Angles(20.0, 5.0), target = Angles(20.0, 5.0), memory = mapOf(Purpose.REST to Angles(15.0, 5.0)))
        val prevOut = "<maum_0>(command=reset_default, purpose=rest, to=previous, confirm=yes)<maum_end>"
        assertEquals("휴식 자세는 되돌릴 이전 값이 없어요", say(s, "휴식 자세 직전 값이 나았어요", prevOut).say)
        // 지금 각도(20, 5)를 휴식 자세로 저장 → 이전 값(15, 5)이 남는다
        val q = say(s, "지금 자세 휴식 자세로 저장해", "<maum_0>(command=set_default, purpose=rest, confirm=no)<maum_end>")
        val saved = if (q.state.pending?.kind == "save") say(q.state, "응", yes).state else q.state
        assertEquals(Angles(20.0, 5.0), saved.memory[Purpose.REST]); assertEquals(Angles(15.0, 5.0), saved.prevMemory[Purpose.REST])
        val ask = say(saved, "괜히 바꿔 저장했나 봐요 직전 값이 나았어요", prevOut)
        assertEquals("휴식 자세의 저장 각도를 이전 값으로 되돌릴까요?", ask.say); assertEquals(saved.memory, ask.state.memory)
        val done = say(ask.state, "응", yes)
        assertEquals("휴식 자세의 저장 각도를 이전 값으로 되돌렸어요", done.say)
        assertEquals(Angles(15.0, 5.0), done.state.memory[Purpose.REST]); assertEquals(saved.target, done.state.target)
        // 한 번도 저장한 적 없던 자세는 이전 값이 "처음 값"이라 되돌리면 저장값이 지워진다
        val t = say(BedState(angles = Angles(30.0, 0.0), target = Angles(30.0, 0.0)), "지금 자세 독서 자세로 저장해", "<maum_0>(command=set_default, purpose=read, confirm=no)<maum_end>")
        val t2 = if (t.state.pending?.kind == "save") say(t.state, "응", yes).state else t.state
        val back = say(say(t2, "독서 자세 이전 값으로 되돌려", "<maum_0>(command=reset_default, purpose=read, to=previous, confirm=no)<maum_end>").state, "응", yes)
        assertNull(back.state.memory[Purpose.READ])
    }

    @Test fun r4DelegationIsNotConsent() {
        val s = daily()
        val a = say(s, "일곱 시 알람 지워", "<maum_1>(command=delete, target=07:00, target_ampm=none, target_days=none, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("delete", a.state.pending?.kind)
        val b = say(a.state, "알아서 해", "<maum_2>(type=delegate, value=none)<maum_end>")
        assertEquals(1, b.state.alarms.size); assertEquals("delete", b.state.pending?.kind); assertTrue(b.say.contains("'응'이라고"))
        assertTrue(say(b.state, "응", yes).state.alarms.isEmpty())
        // 묻는 것이 없으면 무엇을 할지 묻는다
        assertEquals(Rules.WHAT, say(BedState(), "알아서 해", "<maum_2>(type=delegate, value=none)<maum_end>").say)
    }
}
