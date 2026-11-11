package com.jaljayo.board

import com.jaljayo.board.brain.Angles
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
import java.time.LocalDateTime

// 알람·대답·묻기 쪽 세부 기능을 상황별 침대 동작 표대로 시험한다. 시계는 2026-10-27(화) 오전 6시로 고정
class AlarmTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private var nowMs = LocalDateTime.of(2026, 10, 27, 6, 0).atZone(KST).toInstant().toEpochMilli()
    private val brain = Brain { nowMs }

    // 보드처럼 v0.8 모양 skip·disable 출력은 v0.9로 옮긴 뒤 검사한다
    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out)
        assertTrue("규격 위반: $out $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun set7(s: BedState = BedState()) = say(s, "내일 오전 일곱 시에 깨워 줘",
        "<maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
    private fun weekday7(s: BedState = BedState()) = say(s, "평일 오전 일곱 시 알람 맞춰",
        "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>")

    @Test fun setAlarm() {
        val t = set7()
        assertEquals("내일 오전 일곱 시, 기본 알람으로 맞췄어요", t.say)
        assertEquals(1, t.state.alarms.size)
        assertEquals("이미 내일 오전 일곱 시 알람이 맞춰져 있어요", set7(t.state).say)
    }

    // 11/09 이도 님 결정: 새벽=0~5시(dawn), 아침=6~11시(morning). 시각 없이 고를 때만 쓴다
    @Test fun dawnAndMorningPickByHour() {
        val a = say(BedState(), "내일 새벽 다섯 시에 깨워 줘", "<maum_1>(command=set, date=tomorrow, ampm=am, time=05:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        val b = say(a.state, "내일 오전 일곱 시에 깨워 줘", "<maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        val d = say(b.state, "새벽 알람 꺼", "<maum_1>(command=off, target=none, target_ampm=dawn, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("내일 오전 다섯 시 알람을 꺼 뒀어요", d.say)
        assertEquals(listOf(false, true), d.state.alarms.sortedBy { it.time }.map { it.enabled })
        val m = say(b.state, "아침 알람 꺼", "<maum_1>(command=off, target=none, target_ampm=morning, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(listOf(true, false), m.state.alarms.sortedBy { it.time }.map { it.enabled })
        val o = say(b.state, "오전 알람 꺼", "<maum_1>(command=off, target=none, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(o.say, o.say.contains("어떤 알람을 끌까요?"))   // 오전은 둘 다라서 묻는다
        assertTrue(spec.parse("<maum_1>(command=off, target=07:00, target_ampm=morning, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>") is Spec.Result.Bad)
    }

    // 11/09: 고를 알람이 넷 이상이면 셋만 읽지 않고 개수를 말한 뒤 전부인지 묻는다
    @Test fun manyAlarmsAsksAllOrOne() {
        var st = BedState()
        for (h in listOf("06:00", "06:30", "07:00", "07:30", "08:00")) st = say(st, "내일 알람", "<maum_1>(command=set, date=tomorrow, ampm=am, time=$h, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state
        val off = "<maum_1>(command=off, target=none, target_ampm=morning, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>"
        val q = say(st, "아침 알람 꺼", off)
        assertEquals("아침 알람이 다섯 개 있어요. 전부 끌까요? 하나만이면 몇 시 알람인지 말씀해 주세요", q.say)
        val all = say(q.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertTrue(all.state.alarms.none { it.enabled })
        val one = say(q.state, "일곱 시 거", "<maum_2>(type=time, value=am_07:00)<maum_end>")
        assertEquals(1, one.state.alarms.count { !it.enabled })
        val three = say(say(BedState(), "내일 알람", "<maum_1>(command=set, date=tomorrow, ampm=am, time=06:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state, "내일 알람", "<maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertTrue(say(three.state, "아침 알람 꺼", off).say.endsWith("알람이 있어요. 어떤 알람을 끌까요?"))   // 셋 이하는 전부 읽는다
    }

    @Test fun ampmMissingAsksThenYes() {
        val t = say(BedState(), "일곱 시에 깨워", "<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertEquals("오전 일곱 시인가요?", t.say)
        val y = say(t.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals("오늘 오전 일곱 시, 기본 알람으로 맞췄어요", y.say)
    }

    @Test fun timeMissingAsksThenTimeAnswer() {
        val t = say(BedState(), "알람 맞춰 줘", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertEquals("몇 시에 맞출까요?", t.say)
        val a = say(t.state, "오전 여섯 시 반", "<maum_2>(type=time, value=am_06:30)<maum_end>")
        assertEquals("오늘 오전 여섯 시 반, 기본 알람으로 맞췄어요", a.say)
    }

    @Test fun changeTimeAndLaterAsksAmount() {
        val s = weekday7().state
        assertEquals("평일 오전 일곱 시 알람을 오전 여섯 시로 바꿨어요", say(s, "일곱 시 알람 여섯 시로 바꿔",
            "<maum_1>(command=change_time, target=07:00, target_ampm=none, target_days=none, date=none, ampm=none, time=06:00, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>").say)
        val t = say(s, "알람 좀 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=none, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 얼마나 늦출까요?", t.say)
        val a = say(t.state, "십 분", "<maum_2>(type=duration, value=00:10)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 오전 일곱 시 십 분으로 바꿨어요", a.say)
    }

    @Test fun wishAsksForAlarmChange() {
        val s = weekday7().state
        val t = say(s, "일곱 시 알람 십 분만 늦게 울렸으면", "<maum_1>(command=change_time, target=07:00, target_ampm=none, target_days=none, date=none, ampm=none, time=00:10, time_type=later, scope=none, target_type=none, target_order=none, confirm=yes)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 오전 일곱 시 십 분으로 바꿀까요?", t.say)
    }

    @Test fun skipDisableEnableOffDelete() {
        val s = weekday7().state
        assertEquals("평일 오전 일곱 시 알람은 오늘은 울리지 않아요", say(s, "일곱 시 알람 이번만 건너뛰어",
            "<maum_1>(command=skip, target=07:00, target_ampm=none, target_days=none, date=none, confirm=no, target_type=none, target_order=none)<maum_end>").say)
        val d = say(s, "오 일간 알람 꺼 둬", "<maum_1>(command=disable, target=none, target_ampm=none, target_days=none, start=none, until=none, period=5, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 오늘부터 시월 삼십일일까지 꺼 뒀어요. 십일월 일일부터 다시 울려요".replace("시월 삼십일일", "십월 삼십일일").replace("십일월 일일", "십일월 일일"), d.say.replace("시월", "십월"))
        val e = say(d.state, "아침 알람 다시 켜", "<maum_1>(command=enable, target=none, target_ampm=am, target_days=none, date=none, create=no, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 다시 켰어요", e.say)
        val o = say(s, "일곱 시 알람 꺼", "<maum_1>(command=off, target=07:00, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 꺼 뒀어요", o.say)
        val all = say(s, "알람 전부 지워", "<maum_1>(command=delete, target=all, target_ampm=none, target_days=none, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 삭제할까요?", all.say)   // 전부라고 해도 하나뿐이면 그 알람을 말한다
        val y = say(all.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 삭제했어요", y.say); assertEquals(0, y.state.alarms.size)
    }

    @Test fun whichAlarmAsksThenSelect() {
        val eight = say(weekday7().state, "주말 여덟 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>")
        val s = eight.state.copy(lastAlarmId = null)
        val t = say(s, "알람 꺼", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(t.say, t.say.endsWith("어떤 알람을 끌까요?"))
        val a = say(t.state, "평일 거", "<maum_2>(command=select_alarm, target=none, target_ampm=none, target_days=weekdays, date=none, target_type=none, target_order=none)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 꺼 뒀어요", a.say)
    }

    @Test fun ringingButtonAndDelay() {
        var s = weekday7().state
        nowMs += 61 * 60_000L  // 오전 7시 1분
        val r = brain.dueAlarm(s); assertNotNull(r); s = r!!.state
        assertNotNull(s.ringing)
        val d = say(s, "방금 그거 좀 이따 다시 울리면 좋겠는데", "<maum_1>(command=delay_active, time=none, confirm=yes)<maum_end>")
        assertEquals("오 분 미뤘어요", d.say)                      // 울리는 중이면 묻지 않고 바로 미룸
        assertNull(d.state.ringing)
        nowMs += 5 * 60_000L
        val again = brain.dueAlarm(d.state); assertNotNull(again!!.state.ringing)
        val b = brain.alarmButton(again.state)!!
        assertEquals("좋은 아침이에요 알람을 끌게요", b.say); assertNull(b.state.ringing)
    }

    @Test fun questionAlarm() {
        var s = say(BedState(), "덧셈 알람으로 일곱 시 반에 깨워", "<maum_1>(command=set, date=none, ampm=am, time=07:30, time_type=absolute, type=question, repeat=none, days=none, confirm=no)<maum_end>").state
        nowMs += 91 * 60_000L
        s = brain.dueAlarm(s)!!.state
        val b = brain.alarmButton(s, java.util.Random(1))!!
        val q = b.state.question!!
        assertTrue(b.say.endsWith("는 얼마예요?"))
        val wrong = say(b.state, "모르겠는데 백", "<maum_2>(type=number, value=100)<maum_end>")
        assertTrue(wrong.say.startsWith("다시 생각해 보세요"))
        // 11/03: 말에 없는 숫자는 판정하지 않으므로 정답 숫자를 실제로 말한다
        val ok = say(b.state, "정답은 " + com.jaljayo.board.brain.Brain.sino(q.first + q.second), "<maum_2>(type=number, value=${q.first + q.second})<maum_end>")
        assertEquals("정답이에요. 좋은 아침이에요 알람을 끌게요", ok.say); assertNull(ok.state.ringing)
    }

    @Test fun askTimeAndAlarms() {
        val s = weekday7().state
        assertEquals("지금은 오전 여섯 시이에요".replace("시이에요", "시예요"), say(s, "몇 시야", "<maum_4>(command=tell_time)<maum_end>").say.replace("시이에요", "시예요"))
        assertEquals("오늘 알람은 오전 일곱 시 기본 알람 하나예요", say(s, "알람 뭐 있어", "<maum_4>(command=tell_alarms, date=none, days=none)<maum_end>").say)
    }

    @Test fun requestDeleteOnLastAlarm() {
        val s = weekday7().state
        val t = say(s, "그거 없애", "<maum_2>(command=request, operation=delete, target=none, date=none, time=none, target_order=none)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 삭제할까요?", t.say)
        assertEquals(0, say(t.state, "응", "<maum_2>(type=yes, value=none)<maum_end>").state.alarms.size)
    }

    // 11/06: 말한 요일만 울리는 알람이 없고 그 요일을 포함한 알람만 있으면 먼저 알린다. 그 요일만 울리는 알람이 있으면 그대로
    @Test fun dayNoteWhenOnlyWiderAlarm() {
        val s = weekday7().state
        val del = say(s, "수요일 수업이 없어져서 일곱 시 알람 지워 줘",
            "<maum_1>(command=delete, target=07:00, target_ampm=none, target_days=wed, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("수요일만 울리는 알람이 없어요. 평일 오전 일곱 시 알람을 삭제할까요?", del.say)
        assertEquals(1, say(del.state, "아니", "<maum_2>(type=no, value=none)<maum_end>").state.alarms.size)
        val wed = say(BedState(), "수요일 오전 일곱 시 알람 맞춰",
            "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=wed, confirm=no)<maum_end>").state
        assertEquals("수요일 오전 일곱 시 알람을 삭제할까요?", say(wed, "수요일 일곱 시 알람 지워 줘",
            "<maum_1>(command=delete, target=07:00, target_ampm=none, target_days=wed, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>").say)
        val off = say(s, "수요일 일곱 시 알람 꺼 둬",
            "<maum_1>(command=off, target=07:00, target_ampm=none, target_days=wed, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        // 끄기는 바로 실행하지 않고 묻는다. "응"이면 평일 알람만 끄고, "아니"면 그대로
        assertEquals("수요일만 울리는 알람이 없어요. 평일 오전 일곱 시 알람을 꺼 둘까요?", off.say)
        assertTrue(off.state.alarms.all { it.enabled })
        val yes = say(off.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals("평일 오전 일곱 시 알람을 꺼 뒀어요", yes.say)
        assertTrue(yes.state.alarms.none { it.enabled })
        assertTrue(say(off.state, "아니", "<maum_2>(type=no, value=none)<maum_end>").state.alarms.all { it.enabled })
        // 시각 바꾸기도 같다
        val ch = say(s, "수요일 일곱 시 알람 여덟 시로 바꿔 줘",
            "<maum_1>(command=change_time, target=07:00, target_ampm=none, target_days=wed, date=none, ampm=none, time=08:00, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(ch.say, ch.say.startsWith("수요일만 울리는 알람이 없어요. ") && ch.say.endsWith("?"))
        assertEquals(7, ch.state.alarms[0].time.hour)
        assertEquals(8, say(ch.state, "응", "<maum_2>(type=yes, value=none)<maum_end>").state.alarms[0].time.hour)
    }

    @Test fun postureExtras() {
        // 저장 자세 부르기 뒤 조절했다가 "원래대로"(saved)는 그 자세로, "처음 자세"(factory)는 0도로
        var s = say(BedState(), "티비 보는 각도로 맞춰", "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>").state.let { it.copy(angles = it.target) }
        s = say(s, "다리 삼 도 내려", "<maum_0>(command=adjust, part=leg, direction=down, amount=3, amount_type=delta, confirm=no)<maum_end>").state.let { it.copy(angles = it.target) }
        assertEquals("직전 이동에 대해서만 취소할 수 있어요", say(s, "티비 자세로 간 거 취소", "<maum_0>(command=cancel_target_move, part=none, target_angle=none, target_purpose=tv, confirm=no)<maum_end>").say)
        val f = say(s, "처음 자세로 돌려", "<maum_0>(command=undo, confirm=no, part=none, destination=factory)<maum_end>")
        assertEquals(Angles(0.0, 0.0), f.state.target); assertEquals("처음 자세로 돌아갔어요", f.state.after)
        assertEquals("이십사 시간 뒤에 잠 자세로 바꾸도록 예약했어요", say(BedState(), "스물네 시간 뒤에 잠 자세", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=24:00, time_type=relative, confirm=no)<maum_end>").say)
        assertEquals("자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요", say(BedState(), "이틀 뒤에 티비 자세", "<maum_3>(reason=reservation_time_exceeded)<maum_end>").say)
    }
}
