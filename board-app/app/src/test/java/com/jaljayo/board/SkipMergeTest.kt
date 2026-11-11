package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
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

// v0.9 skip(한 번 건너뛰기와 기간 끄기를 합친 명령)을 실제 동작으로 시험한다.
// 시계는 2026-10-27(화) 오전 6시. 알람은 평일 오전 7시(1번)와 매일 오후 9시(2번) 두 개
class SkipMergeTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private var nowMs = at(2026, 10, 27, 6, 0)
    private val brain = Brain { nowMs }
    private fun at(y: Int, mo: Int, d: Int, h: Int, mi: Int) = LocalDateTime.of(y, mo, d, h, mi).atZone(KST).toInstant().toEpochMilli()
    private fun day(m: Int, d: Int) = LocalDate.of(2026, m, d)

    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out)
        assertTrue("규격 위반: $out $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun skip(date: String = "none", start: String = "none", until: String = "none", period: String = "none",
                     target: String = "none", ampm: String = "none", confirm: String = "no") =
        "<maum_1>(command=skip, target=$target, target_ampm=$ampm, target_days=none, date=$date, start=$start, until=$until, period=$period, target_type=none, target_order=none, confirm=$confirm)<maum_end>"
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"
    private val no = "<maum_2>(type=no, value=none)<maum_end>"

    private fun two(): BedState {
        val a = say(BedState(), "평일 오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>")
        val b = say(a.state, "매일 오후 아홉 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=pm, time=09:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>")
        assertEquals(2, b.state.alarms.size)
        return b.state.copy(lastAlarmId = null)
    }
    private fun BedState.seven() = alarms.first { it.time == LocalTime.of(7, 0) }
    private fun BedState.nine() = alarms.first { it.time == LocalTime.of(21, 0) }
    private fun now() = LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(nowMs), KST)

    @Test fun nextOnceWithoutDate() {
        // 날짜 없는 다음 한 번: 대상이 없으면 알람이 있는 다음 날 회차 전부, 대상이 있으면 그 알람의 다음 회차
        val t = say(two(), "알람 다음 한 번만 건너뛰어", skip())
        assertEquals("오늘 알람을 전부 건너뛰었어요", t.say)
        assertEquals(setOf(day(10, 27)), t.state.seven().skips); assertEquals(setOf(day(10, 27)), t.state.nine().skips)
        val u = say(two(), "일곱 시 알람 이번만 건너뛰어", skip(target = "07:00"))
        assertEquals(setOf(day(10, 27)), u.state.seven().skips); assertTrue(u.state.nine().skips.isEmpty())
    }

    @Test fun passedTodayIsNotMovedToTomorrow() {
        nowMs = at(2026, 10, 27, 8, 0)  // 오전 7시 회차는 이미 지남
        val s = two()
        val t = say(s, "일곱 시 알람 오늘 하루만 꺼 줘", skip(date = "today", target = "07:00"))
        assertEquals("평일 오전 일곱 시 알람은 오늘은 더 울릴 회차가 없어요", t.say)
        assertTrue(t.state.seven().skips.isEmpty())
        assertEquals(day(10, 28).atTime(7, 0), t.state.seven().next(now()))   // 내일은 그대로 울림
        val u = say(s, "오늘 알람 하루만 꺼 줘", skip(date = "today"))
        assertTrue(u.state.seven().skips.isEmpty())                          // 지난 회차는 건드리지 않음
        assertEquals(setOf(day(10, 27)), u.state.nine().skips)              // 오늘 남은 오후 9시만
        nowMs = at(2026, 10, 27, 22, 0)
        val v = say(two(), "오늘만 알람 꺼", skip(date = "today"))
        assertEquals("오늘은 더 울릴 알람이 없어요", v.say)
        assertTrue(v.state.alarms.all { it.skips.isEmpty() })
    }

    @Test fun specificDay() {
        val t = say(two(), "일곱 시 알람 금요일은 건너뛰어", skip(date = "fri", target = "07:00"))
        assertEquals(setOf(day(10, 30)), t.state.seven().skips)
        assertTrue(t.state.nine().skips.isEmpty())
        assertEquals(day(10, 27).atTime(7, 0), t.state.seven().next(now()))
    }

    @Test fun thisWeekend() {
        val t = say(two(), "이번 주말만 알람 꺼 줘", skip(date = "this_weekend"))
        assertTrue(t.say, t.say.endsWith("이번 주말에는 울리지 않아요"))
        assertEquals(setOf(day(10, 31), day(11, 1)), t.state.nine().skips)  // 주말에 울리는 알람만
        assertTrue(t.state.seven().skips.isEmpty())
    }

    @Test fun startOnlyAsksHowLong() {
        val t = say(two(), "다음 주 월요일부터 알람 전부 꺼 줘", skip(start = "next_mon", target = "all"))
        assertTrue(t.say, t.say.endsWith("부터 언제까지 꺼 둘까요?"))
        assertEquals("skip_span", t.state.pending?.kind)
        assertTrue(t.state.alarms.all { it.skips.isEmpty() })               // 묻는 동안 바꾸지 않음
        val a = say(t.state, "사흘", "<maum_2>(type=duration, value=days_3)<maum_end>")
        assertEquals(setOf(day(11, 2), day(11, 3), day(11, 4)), a.state.seven().skips)
        assertNull(a.state.pending)
        val b = say(t.state, "수요일까지", "<maum_2>(type=date, value=next_wed)<maum_end>")
        assertEquals(setOf(day(11, 2), day(11, 3), day(11, 4)), b.state.nine().skips)
    }

    @Test fun untilOnly() {
        val t = say(two(), "일곱 시 알람 금요일까지 꺼 둬", skip(until = "fri", target = "07:00"))
        assertEquals((27..30).map { day(10, it) }.toSet(), t.state.seven().skips)
        assertTrue(t.say, t.say.endsWith("다시 울려요"))
    }

    @Test fun severalDaysThenResumes() {
        val t = say(two(), "일곱 시 알람 사흘 동안 꺼 둬", skip(period = "3", target = "07:00"))
        assertEquals((27..29).map { day(10, it) }.toSet(), t.state.seven().skips)
        assertEquals(day(10, 30).atTime(7, 0), t.state.seven().next(now()))  // 나흘째에 다시 울림
        nowMs = at(2026, 10, 29, 23, 0)
        val r = brain.dueAlarm(t.state.copy(timeValid = true))
        assertTrue(r == null || r.state.ringing?.time != LocalTime.of(7, 0))
        assertEquals(day(10, 30).atTime(7, 0), t.state.seven().next(now()))
    }

    // 알람 두 개가 모두 같은 사흘(화·수·목) 안에 울릴 때: 전부 / 이 알람 / 대상 생략
    @Test fun spanTargetRules() {
        val days = (27..29).map { day(10, it) }.toSet()
        val all = say(two(), "알람 전부 사흘만 꺼 줘", skip(period = "3", target = "all"))
        assertEquals(days, all.state.seven().skips); assertEquals(days, all.state.nine().skips)

        val s = two().let { it.copy(lastAlarmId = it.seven().id, lastAlarmUntil = nowMs + 10_000) }  // 방금 평일 오전 7시 알람 얘기를 함
        val one = say(s, "이 알람 사흘만 꺼 줘", skip(period = "3"))
        assertEquals(days, one.state.seven().skips)
        assertTrue(one.state.nine().skips.isEmpty())
        assertEquals(day(10, 27).atTime(21, 0), one.state.nine().next(now()))  // 다른 알람은 예정대로 울림

        val ask = say(two(), "사흘만 꺼 줘", skip(period = "3"))            // 직전 알람이 없고 후보가 둘
        assertTrue(ask.say, ask.say.endsWith("어떤 알람을 꺼 둘까요?"))
        assertEquals("alarm", ask.state.pending?.kind)
        assertTrue(ask.state.alarms.all { it.skips.isEmpty() })            // 대답 전에는 바꾸지 않음
        val pick = say(ask.state, "아홉 시 거", "<maum_2>(command=select_alarm, target=09:00, target_ampm=pm, target_days=none, date=none, target_type=none, target_order=none)<maum_end>")
        assertEquals(days, pick.state.nine().skips)
        assertTrue(pick.state.seven().skips.isEmpty())
    }

    // "이 알람"은 알람 얘기를 끝낸 뒤 10초 안에만 그 알람. 10초가 지나면 알람이 여럿일 때 묻는다(시각 바꾸기 등 다른 명령도 같음)
    @Test fun recentAlarmOnlyForTenSeconds() {
        val a = say(two(), "평일 일곱 시 알람 종류 문제로 바꿔", "<maum_1>(command=change_type, target=07:00, target_ampm=am, target_days=weekdays, date=none, type=question, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        nowMs += 9_000
        val inTime = say(a.state, "이 알람 사흘만 꺼 줘", skip(period = "3"))
        assertEquals((27..29).map { day(10, it) }.toSet(), inTime.state.seven().skips)
        assertTrue(inTime.state.nine().skips.isEmpty())
        nowMs += 2_000                                                       // 마지막 알람 얘기 뒤 11초(사흘 꺼 둔 말 뒤로는 2초)
        val again = say(inTime.state, "그 알람 여덟 시로 바꿔", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=08:00, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(again.say, again.say.contains("여덟 시"))                  // 사흘 꺼 둔 말이 새 기준이라 아직 10초 안
        nowMs += 30_000
        val late = say(again.state, "이 알람 사흘만 꺼 줘", skip(period = "3"))
        assertTrue(late.say, late.say.endsWith("어떤 알람을 꺼 둘까요?"))
        assertEquals("alarm", late.state.pending?.kind)
        val lateReq = say(again.state, "그거 건너뛰어", "<maum_2>(command=request, operation=skip, target=none, date=none, time=none, target_order=none)<maum_end>")
        assertEquals("어떤 알람을 건너뛸까요?", lateReq.say)
        val one = say(BedState(), "평일 오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>")
        nowMs += 3_600_000
        val single = say(one.state, "이 알람 사흘만 꺼 줘", skip(period = "3"))   // 알람이 하나뿐이면 시간이 지나도 그 알람
        assertNull(single.state.pending)
        assertTrue(single.state.alarms[0].skips.isNotEmpty())
    }

    @Test fun namedAlarmDoesNotSilenceOthers() {
        val t = say(two(), "일곱 시 알람 닷새 동안 꺼", skip(period = "5", target = "07:00"))
        assertTrue(t.state.nine().skips.isEmpty())
        assertEquals(day(10, 27).atTime(21, 0), t.state.nine().next(now()))
    }

    @Test fun narrowAllToMorning() {
        val t = say(two(), "내일 알람 하루만 쉬었으면", skip(date = "tomorrow", confirm = "yes"))
        assertNotNull(t.state.pending)
        val a = say(t.state, "오전만", "<maum_2>(type=ampm, value=am)<maum_end>")
        assertNotNull(a.state.pending)                                      // 좁힌 내용으로 다시 물음
        assertTrue(a.state.alarms.all { it.skips.isEmpty() })
        val y = say(a.state, "응", yes)
        assertEquals(setOf(day(10, 28)), y.state.seven().skips)
        assertTrue(y.state.nine().skips.isEmpty())
    }

    @Test fun askFirstThenDecline() {
        val t = say(two(), "일곱 시 알람 사흘쯤 안 울리면 좋겠다", skip(period = "3", target = "07:00", confirm = "yes"))
        assertTrue(t.say, t.say.endsWith("?"))
        assertTrue(t.state.alarms.all { it.skips.isEmpty() })
        val n = say(t.state, "아니", no)
        assertNull(n.state.pending)
        assertTrue(n.state.alarms.all { it.skips.isEmpty() })
    }

    @Test fun enableClearsSkipSpan() {
        val t = say(two(), "일곱 시 알람 사흘 동안 꺼 둬", skip(period = "3", target = "07:00"))
        val e = say(t.state, "일곱 시 알람 다시 켜", "<maum_1>(command=enable, target=07:00, target_ampm=none, target_days=none, date=none, create=no, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 다시 켰어요", e.say)
        assertTrue(e.state.seven().skips.isEmpty())
        assertEquals(day(10, 27).atTime(7, 0), e.state.seven().next(now()))
    }

    @Test fun storedOldRecordsStillWork() {
        // 업데이트 전에 저장된 기록: 그날 건너뛰기(skips)와 기간 끄기(offFrom·offUntil)
        val f = File.createTempFile("bed_state", ".json"); f.deleteOnExit()
        val old = AlarmItem(1, LocalTime.of(7, 0), AlarmItem.WEEKDAYS, offFrom = day(10, 27), offUntil = day(10, 28))
        val other = AlarmItem(2, LocalTime.of(21, 0), java.time.DayOfWeek.entries.toSet(), skips = setOf(day(10, 29)))
        Store(f).save(BedState(alarms = listOf(old, other)))
        val s = Store(f).load(BedState())
        assertEquals(day(10, 29).atTime(7, 0), s.alarms[0].next(now()))   // 끝난 다음 날 다시 울림
        assertEquals(day(10, 27).atTime(21, 0), s.alarms[1].next(now()))
        assertEquals(day(10, 30).atTime(21, 0), s.alarms[1].next(LocalDateTime.of(2026, 10, 28, 22, 0)))
        val e = say(s.copy(lastAlarmId = null), "일곱 시 알람 다시 켜", "<maum_1>(command=enable, target=07:00, target_ampm=none, target_days=none, date=none, create=no, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(day(10, 27).atTime(7, 0), e.state.alarms[0].next(now()))
    }

    @Test fun oldModelOutputsAreUpgraded() {
        val oldDisable = "<maum_1>(command=disable, target=none, target_ampm=am, target_days=none, start=none, until=today, period=none, target_type=none, target_order=none, confirm=no)<maum_end>"
        assertEquals(skip(date = "today", ampm = "am"), Spec.upgrade(oldDisable))
        val oldSpan = "<maum_1>(command=disable, target=07:00, target_ampm=none, target_days=none, start=tomorrow, until=none, period=3, target_type=none, target_order=none, confirm=yes)<maum_end>"
        assertEquals(skip(start = "tomorrow", period = "3", target = "07:00", confirm = "yes"), Spec.upgrade(oldSpan))
        val oldSkip = "<maum_1>(command=skip, target=none, target_ampm=pm, target_days=none, date=none, confirm=no, target_type=none, target_order=none)<maum_end>"
        assertEquals(skip(ampm = "pm"), Spec.upgrade(oldSkip))
        assertEquals(skip(ampm = "pm"), Spec.upgrade(skip(ampm = "pm")))                    // 새 출력은 그대로
        assertTrue(spec.parse(oldDisable) is Spec.Result.Bad)                                  // 옮기지 않으면 v0.9 검사에서 거절
    }

    @Test fun contextRequestSkip() {
        val s = two().let { it.copy(lastAlarmId = it.seven().id, lastAlarmUntil = nowMs + 10_000) }
        val t = say(s, "그거 건너뛰어", "<maum_2>(command=request, operation=skip, target=none, date=none, time=none, target_order=none)<maum_end>")
        assertTrue(t.say, t.say.endsWith("회차를 건너뛸까요?"))
        val y = say(t.state, "응", yes)
        assertEquals(setOf(day(10, 27)), y.state.seven().skips)
    }
}
