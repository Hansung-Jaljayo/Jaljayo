package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.DayOfWeek
import java.time.LocalTime

// 11/13: 건너뛰기 되묻기 뒤 안내, 읽어 준 목록에서 순서로 지우기, 예약을 지금부터 N 뒤로, 하루가 넘는 상대 예약
class Round20BoardTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val start = 1_800_000_000_000L   // 한국 시간 2027년 1월 15일 금요일 오후 5시
    private var nowMs = start
    private val brain = Brain { nowMs }
    private fun say(s: BedState, heard: String, out: String): Turn {
        val r = spec.parse(Spec.upgrade(out))
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private val flat = BedState(timeValid = true)
    private val every = DayOfWeek.entries.toSet()
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"
    private val skipReq = "<maum_2>(command=request, operation=skip, target=none, date=none, time=none, target_order=none)<maum_end>"
    private val LIMIT = "자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요"
    private fun reserve(purpose: String, time: String) =
        "<maum_0>(command=reserve, purpose=$purpose, date=none, ampm=none, time=$time, time_type=relative, confirm=no)<maum_end>"
    // "어떤 알람을 건너뛸까요?"라고 막 물은 상태(알람 두 개, 방금 이야기한 알람 없음)
    private fun asked(): BedState {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every), AlarmItem(2, LocalTime.of(8, 0), every)))
        val q = say(s, "건너뛰어 줘", skipReq)
        assertEquals("어떤 알람을 건너뛸까요?", q.say)
        return q.state
    }

    // ---------- 1. 건너뛰기 되묻기 뒤 안내 ----------
    @Test fun skipAskThenReserveCommandSaysAlarmOnly() {
        val s = asked()
        val t = say(s, "한 시간 뒤 독서 자세 예약", reserve("read", "01:00"))
        assertEquals("건너뛰는 건 알람만 할 수 있어요", t.say)
        assertNull(t.state.reservation)
        assertNull(t.state.pending)
        assertEquals(s.alarms, t.state.alarms)
        assertEquals("", t.state.skipAsk)   // 안내 뒤 창을 닫는다
        // 창이 닫혔으므로 같은 말을 다시 하면 평소대로 예약된다
        val again = say(t.state, "한 시간 뒤 독서 자세 예약", reserve("read", "01:00"))
        assertEquals("한 시간 뒤에 독서 자세로 바꾸도록 예약했어요", again.say)
    }

    @Test fun skipAskThenPostureNameOrNumberSaysAlarmOnly() {
        val s = asked()
        for ((heard, out) in listOf("독서 자세" to "<maum_2>(type=purpose, value=read)<maum_end>", "머리" to "<maum_2>(type=part, value=head)<maum_end>",
            "삼십" to "<maum_2>(type=number, value=30)<maum_end>", "예약 뭐 있어" to "<maum_4>(command=tell_reservations)<maum_end>",
            "예약 취소해" to "<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>")) {
            val t = say(s, heard, out)
            assertEquals(heard, "건너뛰는 건 알람만 할 수 있어요", t.say)
            assertEquals(heard, s.copy(skipAsk = "", skipAskUntil = 0L), t.state)   // 창만 닫히고 나머지는 그대로
        }
    }

    @Test fun skipAskThenAdjustMovesAsUsual() {
        val t = say(asked(), "머리 올려 줘", "<maum_0>(command=adjust, part=head, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>")
        assertEquals("", t.say)
        assertEquals(10.0, t.state.target.head, 0.0)
        assertEquals("머리를 10도 올렸어요", t.state.after)
    }

    @Test fun skipAskThenStopStillStops() {
        // 움직이는 중에 물었어도 멈춤은 막지 않는다
        val moving = asked().copy(angles = Angles(5.0, 0.0), target = Angles(30.0, 0.0), moveStart = Angles(0.0, 0.0))
        val quick = brain.quickStop(moving, "멈춰")!!
        assertEquals("머리를 5도까지 올리고 멈췄어요", quick.say)
        assertEquals(Angles(5.0, 0.0), quick.state.target)
        // 모델을 거친 그만("그만해", 대답 cancel)도 멈춘다
        val t = say(moving, "그만해", "<maum_2>(type=cancel, value=none)<maum_end>")
        assertEquals("머리를 5도까지 올리고 멈췄어요", t.say)
        assertEquals(Angles(5.0, 0.0), t.state.target)
    }

    @Test fun skipAskWindowPassedHandlesAsUsual() {
        val s = asked()
        nowMs = start + 20_001L
        val t = say(s, "한 시간 뒤 독서 자세 예약", reserve("read", "01:00"))
        assertEquals("한 시간 뒤에 독서 자세로 바꾸도록 예약했어요", t.say)
        assertEquals(Purpose.READ, t.state.reservation?.purpose)
        // 20초 안이면 안내한다(경계)
        nowMs = start + 20_000L
        assertEquals("건너뛰는 건 알람만 할 수 있어요", say(s, "한 시간 뒤 독서 자세 예약", reserve("read", "01:00")).say)
    }

    @Test fun withoutSkipAskHandlesAsUsual() {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every), AlarmItem(2, LocalTime.of(8, 0), every)))
        val t = say(s, "한 시간 뒤 독서 자세 예약", reserve("read", "01:00"))
        assertEquals("한 시간 뒤에 독서 자세로 바꾸도록 예약했어요", t.say)
        assertEquals(start + 60 * 60_000L, t.state.reservation?.atMs)
        assertEquals("머리 올릴까요, 내릴까요?", say(s, "머리", "<maum_2>(type=part, value=head)<maum_end>").say)
    }

    // 알람을 고르는 대답은 묻던 건너뛰기로 이어진다
    @Test fun skipAskThenAlarmChoiceContinues() {
        val t = say(asked(), "일곱 시 거", "<maum_2>(command=select_alarm, target=07:00, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none)<maum_end>")
        assertEquals(setOf(java.time.LocalDate.of(2027, 1, 16)), t.state.alarms.first { it.id == 1 }.skips)
        assertEquals(emptySet<java.time.LocalDate>(), t.state.alarms.first { it.id == 2 }.skips)
    }

    // ---------- 2. 목록을 읽어 준 뒤 순서로 지우기 ----------
    private val three = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(9, 0), every), AlarmItem(2, LocalTime.of(7, 0), every), AlarmItem(3, LocalTime.of(8, 0), every)))
    private fun del(order: String) = "<maum_2>(command=request, operation=delete, target=none, date=none, time=none, target_order=$order)<maum_end>"
    private fun listed(): BedState {
        val read = say(three, "알람 뭐 있어", "<maum_4>(command=tell_alarms, date=none, days=none, target_type=none)<maum_end>")
        assertEquals("내일 알람은 오전 일곱 시 기본 알람, 오전 여덟 시 기본 알람, 오전 아홉 시 기본 알람이 있어요", read.say)
        assertEquals(listOf(2, 3, 1), read.state.listed)
        return read.state.copy(lastAlarmId = null)   // 방금 이야기한 알람은 없는 상태
    }

    @Test fun deleteLastOfListedAsksThenDeletes() {
        val q = say(listed(), "마지막 거 지워", del("last"))
        assertEquals("매일 오전 아홉 시 알람을 삭제할까요?", q.say)
        assertEquals("delete", q.state.pending?.kind)
        assertEquals(3, q.state.alarms.size)   // 대답 전에는 그대로
        val t = say(q.state, "응", yes)
        assertEquals("매일 오전 아홉 시 알람을 삭제했어요", t.say)
        assertEquals(listOf(2, 3), t.state.alarms.map { it.id })
    }

    @Test fun deleteSecondOfListedAsksThenDeletes() {
        val q = say(listed(), "두 번째 거 지워", del("index_2"))
        assertEquals("매일 오전 여덟 시 알람을 삭제할까요?", q.say)
        val t = say(q.state, "응", yes)
        assertEquals("매일 오전 여덟 시 알람을 삭제했어요", t.say)
        assertEquals(listOf(1, 2), t.state.alarms.map { it.id })
        // 목록보다 큰 순서는 지우지 않고 다시 묻는다
        val over = say(listed(), "네 번째 거 지워", del("index_4"))
        assertEquals("무엇을 삭제할까요?", over.say)
        assertNull(over.state.pending)
        assertEquals(3, over.state.alarms.size)
    }

    @Test fun deleteByOrderWithoutListAsksWhat() {
        val t = say(three, "마지막 거 지워", del("last"))
        assertEquals("무엇을 삭제할까요?", t.say)
        assertNull(t.state.pending)
        assertEquals(three.alarms, t.state.alarms)
        // 읽어 준 지 10초가 지나면 목록은 쓰지 않는다
        val s = listed()
        nowMs = start + 10_001L
        assertEquals("무엇을 삭제할까요?", say(s, "마지막 거 지워", del("last")).say)
    }

    // ---------- 3. 예약을 지금부터 N 뒤로 ----------
    @Test fun changeReserveRelativeMovesFromNow() {
        val r = say(flat, "삼십 분 뒤에 독서 자세로 예약해 줘", reserve("read", "00:30")).state
        assertEquals(start + 30 * 60_000L, r.reservation?.atMs)
        val t = say(r, "삼십 분 뒤로 잡아 둔 예약 한 시간 뒤로 미뤄 줘",
            "<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=01:00, time_type=relative, confirm=no)<maum_end>")
        assertEquals("독서 자세 예약을 한 시간 뒤로 바꿨어요", t.say)
        assertEquals(start + 60 * 60_000L, t.state.reservation?.atMs)   // 원래 시각 + 한 시간이 아니라 지금 + 한 시간
        assertEquals("한 시간 뒤", t.state.reservation?.label)
        assertEquals(Purpose.READ, t.state.reservation?.purpose)
    }

    // ---------- 4. 하루가 넘는 상대 예약 ----------
    @Test fun dayPlusHoursRelativeReserveIsRefused() {
        val t = say(flat, "티비 자세 예약할게요 지금부터 하루하고도 세 시간 뒤예요", reserve("tv", "03:00"))
        assertEquals(LIMIT, t.say)
        assertNull(t.state.reservation)
        assertNull(t.state.pending)
        for (h in listOf("이틀 뒤에 독서 자세로 예약해 줘", "삼 일 후에 독서 자세 예약", "며칠 있다가 독서 자세로 바꿔 줘", "2일 뒤 독서 자세 예약")) {
            val x = say(flat, h, reserve("read", "02:00"))
            assertEquals(h, LIMIT, x.say)
            assertNull(h, x.state.reservation)
        }
        // 걸린 예약을 옮길 때도 같다(예약은 그대로)
        val r = say(flat, "삼십 분 뒤에 독서 자세로 예약해 줘", reserve("read", "00:30")).state
        val c = say(r, "예약 하루하고 한 시간 뒤로 미뤄 줘", "<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=01:00, time_type=relative, confirm=no)<maum_end>")
        assertEquals(LIMIT, c.say)
        assertEquals(r.reservation, c.state.reservation)
    }

    @Test fun ordinaryRelativeReserveStillWorks() {
        val t = say(flat, "삼십 분 뒤에 티비 자세로 예약해 줘", reserve("tv", "00:30"))
        assertEquals("삼십 분 뒤에 TV 자세로 바꾸도록 예약했어요", t.say)
        assertEquals(start + 30 * 60_000L, t.state.reservation?.atMs)
        // 다른 뜻의 "하루", 분 앞의 "일"은 막지 않는다
        for (h in listOf("하루 종일 누워 있었네 삼십 분 뒤에 티비 자세로 해 줘", "오늘 하루만 삼십 분 뒤에 티비 자세로 해 줘", "십일 분 뒤에 티비 자세 예약", "오후에 말고 삼십 분 뒤에 티비 자세 예약"))
            assertEquals(h, start + 30 * 60_000L, say(flat, h, reserve("tv", "00:30")).state.reservation?.atMs)
    }
}
