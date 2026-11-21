package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// 11/14 22차 준비(계획 5절): 모델이 [앞 대답]의 알람을 시각으로 가리키고 날짜·오전오후를 비우면 보드가 앞 대답에서 채운다
class Round22BoardTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val t0 = LocalDateTime.of(2026, 11, 16, 15, 0).atZone(KST).toInstant().toEpochMilli()   // 월요일 오후 3시
    private var nowMs = t0
    private val brain = Brain { nowMs }
    private val today = LocalDate.of(2026, 11, 16)
    private fun say(s: BedState, heard: String, out: String): Turn {
        val r = spec.parse(Spec.upgrade(out))
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.recordAsked(s, brain.handleSafely(s, heard, (r as Spec.Result.Ok).cmd, out))
    }
    private fun set(date: String, ap: String, t: String, type: String = "basic") =
        "<maum_1>(command=set, date=$date, ampm=$ap, time=$t, time_type=absolute, type=$type, repeat=none, days=none, confirm=no)<maum_end>"
    private fun delete(t: String, ap: String = "none", date: String = "none") =
        "<maum_1>(command=delete, target=$t, target_ampm=$ap, target_days=none, date=$date, state=any, target_type=none, target_order=none, confirm=no)<maum_end>"
    private fun changeTime(t: String, nt: String, ap: String = "none", nap: String = "none") =
        "<maum_1>(command=change_time, target=$t, target_ampm=$ap, target_days=none, date=none, ampm=$nap, time=$nt, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>"

    /** 내일 오후 여섯 시 삼십삼 분 알람을 맞추고 목록을 읽어 준 뒤, 같은 시각 알람이 사흘 뒤(오전·오후)에도 있는 상태 */
    private fun listed(): BedState {
        nowMs = t0
        var s = say(BedState(), "알람 맞춰 줘", set("tomorrow", "pm", "06:33")).state
        val t = say(s, "내일 알람 뭐 있어", "<maum_4>(command=tell_alarms, date=tomorrow, days=none, target_type=none)<maum_end>")
        assertEquals("내일 알람은 오후 여섯 시 삼십삼 분 기본 알람 하나예요", t.say)
        s = t.state
        s = s.copy(alarms = s.alarms + AlarmItem(90, LocalTime.of(18, 33), onceDate = today.plusDays(4)) + AlarmItem(91, LocalTime.of(6, 33), onceDate = today.plusDays(4)))
        nowMs = t0 + 20_000   // "잘자요"를 부르고 다시 말하는 데 20초("방금 이야기한 알람" 10초는 지남)
        return s
    }

    @Test fun deleteFillsDateFromReply() {
        val s = listed()
        val t = say(s, "그 알람 삭제해", delete("06:33", "pm"))
        assertEquals("내일 오후 여섯 시 삼십삼 분 알람을 삭제할까요?", t.say)
        assertEquals(listOf(today.plusDays(1)), t.state.pending?.alarms?.map { it.onceDate })
        assertTrue(t.note, t.note.contains("날짜=내일"))
        // 오전·오후까지 비워도 앞 대답 알람(오후)으로 채운다
        val t2 = say(s, "그 알람 삭제해", delete("06:33"))
        assertEquals("내일 오후 여섯 시 삼십삼 분 알람을 삭제할까요?", t2.say)
    }

    @Test fun noFillAfterTwoMinutesOrQuestion() {
        val s = listed()
        nowMs = t0 + 130_000   // 앞 대답 뒤 2분이 지남
        val t = say(s, "그 알람 삭제해", delete("06:33", "pm"))
        assertTrue(t.say, t.say.endsWith("어떤 알람을 삭제할까요?"))
        // 보드가 물으면(앞 질문) 앞 대답의 알람은 비운다
        val s2 = listed()
        val q = say(s2, "알람 꺼", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(q.say, q.say.endsWith("?"))
        assertEquals(emptyList<Int>(), q.state.replyAlarms)
    }

    @Test fun otherTimeIsNotFilled() {
        val s = listed()
        val t = say(s, "여섯 시 삼십사 분 알람 지워", delete("06:34"))
        assertEquals("말씀하신 알람이 없어요", t.say)
        assertEquals("", t.note)
    }

    @Test fun changeTimeKeepsReplyAmPmAndPicksReplyAlarm() {
        nowMs = t0
        var s = say(BedState(), "알람 맞춰 줘", set("tomorrow", "am", "12:30", "question")).state
        s = s.copy(alarms = s.alarms + AlarmItem(90, LocalTime.of(0, 30), onceDate = today.plusDays(4)))
        nowMs += 20_000
        // "열두 시 십 분으로": 오전 열두 시 반 알람이라 새 시각도 오전(0시 10분). 오전·오후를 안 채우면 낮 12시 10분이 된다
        val t = say(s, "그 알람 열두 시 십 분으로 바꿔 줘", changeTime("12:30", "12:10"))
        assertEquals(LocalTime.of(0, 10), t.state.alarms.first { it.id == 1 }.time)
        assertEquals(LocalTime.of(0, 30), t.state.alarms.first { it.id == 90 }.time)   // 같은 시각의 다른 날 알람은 그대로(앞 대답 알람을 고름)
        // 종류는 이어받지 않는다(11-26): target_type을 채우지 않는다
        assertTrue(t.note, !t.note.contains("종류"))
    }

    @Test fun ambiguousReplyIsNotFilled() {
        nowMs = t0
        var s = say(BedState(), "알람", set("tomorrow", "am", "07:00")).state
        s = say(s, "알람", set("tomorrow", "pm", "07:00")).state
        val l = say(s, "내일 알람", "<maum_4>(command=tell_alarms, date=tomorrow, days=none, target_type=none)<maum_end>")
        assertEquals(2, l.state.replyAlarms.size)
        nowMs += 20_000
        val t = say(l.state, "일곱 시 알람 지워", delete("07:00"))
        assertTrue(t.say, t.say.endsWith("어떤 알람을 삭제할까요?"))   // 앞 대답에 오전·오후 둘이 나와 고르지 않고 되묻는다
    }

    @Test fun enableGetsNoDate() {
        nowMs = t0
        var s = say(BedState(), "알람", set("tomorrow", "am", "07:00")).state
        val off = say(s, "그 알람 꺼", "<maum_1>(command=off, target=07:00, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("내일 오전 일곱 시 알람을 꺼 뒀어요", off.say)
        nowMs += 20_000
        val on = say(off.state, "다시 켜 줘", "<maum_1>(command=enable, target=07:00, target_ampm=none, target_days=none, date=none, create=no, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(on.state.alarms.single().enabled)   // 날짜를 넣으면 "그 회차만 켜기"가 되어 꺼진 채로 남는다
    }

    // 숫자 교정(numfix22)과 같은 기준: "삼십이라고"는 30·32 둘로 들려 덧셈 답이면 다시 묻는다
    @Test fun saidThirtyIsAmbiguous() {
        assertEquals(listOf(30, 32), Brain.finalAnswer("삼십이라고 했어"))
        assertEquals(listOf(33), Brain.finalAnswer("삼십삼이라고 했어"))
    }
}
