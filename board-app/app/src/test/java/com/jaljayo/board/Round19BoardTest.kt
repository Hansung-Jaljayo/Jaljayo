package com.jaljayo.board

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

// 11/13: 예약 자세 바꾸기(change_reserve_purpose)에서 어느 예약인지 말하지 않았을 때(target=none)
// 걸린 예약이 있으면 바꿀지 먼저 묻고, 없으면 새 예약을 맞출지 묻는다
class Round19BoardTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }
    private fun say(s: BedState, heard: String, out: String): Turn {
        val r = spec.parse(Spec.upgrade(out))
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private val flat = BedState(timeValid = true)
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"
    private val no = "<maum_2>(type=no, value=none)<maum_end>"
    private fun change(target: String, purpose: String, confirm: String = "no") =
        "<maum_0>(command=change_reserve_purpose, target=$target, purpose=$purpose, confirm=$confirm)<maum_end>"
    // 한 시간 뒤 독서 자세 예약이 걸린 상태
    private val reserved = say(flat, "한 시간 뒤에 독서 자세로 예약해 줘", "<maum_0>(command=reserve, purpose=read, date=none, ampm=none, time=01:00, time_type=relative, confirm=no)<maum_end>").state

    // (a) 예약 있음 + 어느 예약인지 말하지 않음 → 먼저 묻고, "응"이면 바꾼다
    @Test fun askFirstThenYesChanges() {
        val q = say(reserved, "예약 잠 자세로 해 줘", change("none", "sleep"))
        assertEquals("독서 자세 예약을 잠 자세로 바꿀까요?", q.say)
        assertEquals(reserved.reservation, q.state.reservation)   // 대답 전에는 그대로
        assertEquals("confirm", q.state.pending?.kind)
        val t = say(q.state, "응", yes)
        assertEquals("한 시간 뒤 예약을 잠 자세 예약으로 바꿨어요", t.say)
        assertEquals(Purpose.SLEEP, t.state.reservation?.purpose)
        assertEquals(Rules.DEFAULTS.getValue(Purpose.SLEEP), t.state.reservation!!.target)
        assertEquals(reserved.reservation!!.atMs, t.state.reservation!!.atMs)   // 시각은 그대로
        assertNull(t.state.pending)
    }

    // (b) 같은 질문에 "아니"면 바꾸지 않는다
    @Test fun askFirstThenNoKeeps() {
        val q = say(reserved, "예약 잠 자세로 해 줘", change("none", "sleep"))
        val t = say(q.state, "아니", no)
        assertEquals(reserved.reservation, t.state.reservation)
        assertNull(t.state.pending)
        assertEquals("", t.say)
    }

    // (c) 예약 없음 → 새 예약을 맞출지 묻고, "응"이면 시각을 묻는다
    @Test fun noReservationOffersNewThenAsksTime() {
        val q = say(flat, "예약 잠 자세로 해 줘", change("none", "sleep"))
        assertEquals("잠 자세 예약을 맞출까요?", q.say)
        assertNull(q.state.reservation)
        val t = say(q.state, "응", yes)
        assertEquals("몇 시에 바꿀까요?", t.say)
        assertEquals("set_time", t.state.pending?.kind)
        assertNull(t.state.reservation)
        // 시각을 대답하면 그 자세로 새 예약이 걸린다
        val done = say(t.state, "한 시간 뒤", "<maum_2>(type=duration, value=01:00)<maum_end>")
        assertEquals(Purpose.SLEEP, done.state.reservation?.purpose)
        assertEquals(1_800_000_000_000L + 60 * 60_000L, done.state.reservation?.atMs)
        // 없는 예약의 자세를 말했어도(target=rest) 똑같이 새 예약을 묻는다
        assertEquals("TV 자세 예약을 맞출까요?", say(flat, "휴식 예약 티비로 바꿔", change("rest", "tv")).say)
        // 바꿀 자세도 없으면 예약이 없다고만 한다(규격은 purpose=none을 받지 않으므로 두뇌에 바로 넣어 본다)
        val none = change("none", "none")
        assertEquals(Rules.NO_RESERVATION, brain.handle(flat, "예약 바꿔 줘", Brain.parseKv(none), none).say)
    }

    // (d) 예약 없음 → "아니"면 아무 일도 하지 않는다
    @Test fun noReservationOfferThenNoDoesNothing() {
        val q = say(flat, "예약 잠 자세로 해 줘", change("none", "sleep"))
        val t = say(q.state, "아니", no)
        assertNull(t.state.reservation)
        assertNull(t.state.pending)
        assertEquals("", t.say)
        assertEquals(flat.target, t.state.target)
    }

    // (e) 어느 예약인지 분명히 말했고 걸린 예약과 맞으면 묻지 않고 바로 바꾼다
    @Test fun namedTargetChangesAtOnce() {
        val t = say(reserved, "독서 자세 예약 휴식 자세로 바꿔 줘", change("read", "rest"))
        assertEquals("한 시간 뒤 예약을 휴식 자세 예약으로 바꿨어요", t.say)
        assertEquals(Purpose.REST, t.state.reservation?.purpose)
        assertNull(t.state.pending)
        // 걸린 예약과 다른 자세를 말하면 바꾸지 않고 걸린 예약을 알린다
        val w = say(reserved, "잠 자세 예약 티비로 바꿔", change("sleep", "tv"))
        assertEquals("현재는 한 시간 뒤 독서 자세 예약이 걸려 있어요", w.say)
        assertEquals(reserved.reservation, w.state.reservation)
    }

    // 이미 같은 자세면 묻지 않고 알린다
    @Test fun sameAsReservedSaysAlready() {
        val t = say(reserved, "예약 독서 자세로 해 줘", change("none", "read"))
        assertEquals("이미 한 시간 뒤 독서 자세 예약이에요", t.say)
        assertNull(t.state.pending)
    }

    // 각도만 정한 예약과 평평하게: 질문 문장이 어색하지 않아야 한다
    @Test fun angleOnlyAndFlatWording() {
        val angles = say(flat, "삼십 분 뒤에 이십 삼십 해 줘", "<maum_0>(command=reserve_angles, date=none, ampm=none, time=00:30, time_type=relative, head=20, leg=30, confirm=no)<maum_end>").state
        val q = say(angles, "예약 잠 자세로 해 줘", change("none", "sleep"))
        assertEquals("머리 20도, 다리 30도로 바꾸는 예약을 잠 자세로 바꿀까요?", q.say)
        val t = say(q.state, "응", yes)
        assertEquals(Purpose.SLEEP, t.state.reservation?.purpose)
        assertEquals(false, t.state.reservation?.angleOnly)
        assertEquals(Rules.DEFAULTS.getValue(Purpose.SLEEP), t.state.reservation?.target)
        val f = say(reserved, "예약 평평하게 해 줘", change("none", "flat"))
        assertEquals("독서 자세 예약을 평평하게 바꾸는 예약으로 바꿀까요?", f.say)
    }

    // 바람 말투(confirm=yes)여도 한 번만 묻고, "응"이면 바꾼다
    @Test fun wishFormAsksOnce() {
        val q = say(reserved, "예약 잠 자세로 해 주면 좋겠어", change("none", "sleep", "yes"))
        assertEquals("독서 자세 예약을 잠 자세로 바꿀까요?", q.say)
        assertEquals(reserved.reservation, q.state.reservation)
        assertEquals(Purpose.SLEEP, say(q.state, "응", yes).state.reservation?.purpose)
    }
}
