package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
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

// 11/12: 17차 새 명령 4개(듣고 있는지, 각도 예약, 조절 예약, 예약 자세 바꾸기)와 붙여 말한 두 각도, 말소리 10단계
class Round18BoardTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }
    private fun say(s: BedState, heard: String, out: String): Turn {
        val r = spec.parse(Spec.upgrade(out))
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private val flat = BedState(timeValid = true)

    @Test fun listening() {
        val t = say(flat, "내 말 들려", "<maum_4>(command=tell_listening)<maum_end>")
        assertEquals(Rules.LISTENING, t.say); assertEquals(flat.target, t.state.target)
    }

    @Test fun reserveAngles() {
        val t = say(flat, "삼십 분 뒤에 이십 삼십 해 줘", "<maum_0>(command=reserve_angles, date=none, ampm=none, time=00:30, time_type=relative, head=20, leg=30, confirm=no)<maum_end>")
        val r = t.state.reservation; assertNotNull(t.say, r)
        assertEquals(Angles(20.0, 30.0), r!!.target); assertTrue(r.angleOnly)
        assertEquals(1_800_000_000_000L + 30 * 60_000L, r.atMs)
        assertEquals(flat.target, t.state.target)   // 지금은 안 움직임
        assertTrue(t.say, "머리 20도, 다리 30도" in t.say)
        // 최대를 넘으면 최대로
        val o = say(flat, "한 시간 뒤에 팔십 칠십", "<maum_0>(command=reserve_angles, date=none, ampm=none, time=01:00, time_type=relative, head=80, leg=70, confirm=yes)<maum_end>")
        assertNull(o.state.reservation)   // 바람 꼴은 먼저 묻는다
        assertNotNull(o.state.pending)
        // 시각이 없으면 묻는다
        val q = say(flat, "이십 삼십으로 예약해 줘", "<maum_0>(command=reserve_angles, date=none, ampm=none, time=none, time_type=none, head=20, leg=30, confirm=no)<maum_end>")
        assertEquals("set_time", q.state.pending?.kind)
    }

    @Test fun reserveAdjustUsesAnglesAtThatTime() {
        val t = say(flat, "한 시간 뒤에 머리 삼십 도 올려 줘", "<maum_0>(command=reserve_adjust, date=none, ampm=none, time=01:00, time_type=relative, part=head, direction=up, amount=30, amount_type=delta, confirm=no)<maum_end>")
        val r = t.state.reservation; assertNotNull(t.say, r)
        assertEquals("머리를 삼십 도 올리도록", t.say.substringAfter("에 ").substringBefore(" 예약"))
        // 그 사이 머리를 이십 도로 올려 두었으면 예약 시각에 오십 도
        val later = flat.copy(target = Angles(20.0, 0.0), angles = Angles(20.0, 0.0))
        assertEquals(Angles(50.0, 0.0), brain.reservedTarget(later, r!!))
        // 최대(60)를 넘지 않는다
        assertEquals(60.0, brain.reservedTarget(flat.copy(target = Angles(50.0, 0.0)), r).head, 0.0)
        // 부위가 없고 직전 부위도 없으면 묻는다
        val p = say(flat, "한 시간 뒤에 좀 올려 줘", "<maum_0>(command=reserve_adjust, date=none, ampm=none, time=01:00, time_type=relative, part=none, direction=up, amount=small, amount_type=delta, confirm=no)<maum_end>")
        assertEquals("part", p.state.pending?.kind)
    }

    @Test fun changeReservePurpose() {
        val r0 = say(flat, "한 시간 뒤에 휴식 자세로 예약해 줘", "<maum_0>(command=reserve, purpose=rest, date=none, ampm=none, time=01:00, time_type=relative, confirm=no)<maum_end>").state
        assertEquals(Purpose.REST, r0.reservation?.purpose)
        val t = say(r0, "휴식 자세 예약 독서 자세로 바꿔 줘", "<maum_0>(command=change_reserve_purpose, target=rest, purpose=read, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, t.state.reservation?.purpose)
        assertEquals(r0.reservation!!.atMs, t.state.reservation!!.atMs)   // 시각은 그대로
        assertEquals(Rules.DEFAULTS.getValue(Purpose.READ), t.state.reservation!!.target)
        // 다른 예약 자세를 말하면 바꾸지 않는다
        val w = say(r0, "잠 자세 예약 티비로 바꿔", "<maum_0>(command=change_reserve_purpose, target=sleep, purpose=tv, confirm=no)<maum_end>")
        assertEquals(Purpose.REST, w.state.reservation?.purpose)
        // 예약이 없으면 새 예약을 맞출지 묻는다(11/13)
        assertEquals("독서 자세 예약을 맞출까요?", say(flat, "예약 독서로 바꿔", "<maum_0>(command=change_reserve_purpose, target=none, purpose=read, confirm=no)<maum_end>").say)
    }

    @Test fun joinedAngles() {
        // 한 가지로 읽히면 그 값
        assertEquals(listOf(30 to 50), Brain.anglePairs("삼십오십 해 줘"))
        // 둘로 읽히면 다시 말해 달라고 하고, 연달아 두 번째에는 쉬어 말하라고 안내
        assertEquals(2, Brain.anglePairs("이십오십오 해 줘")!!.size)
        val a = say(flat, "이십오십오 해 줘", "<maum_0>(command=set_angles, purpose=none, head=25, leg=15, confirm=no)<maum_end>")
        assertEquals(Rules.ANGLE_AGAIN, a.say); assertEquals(flat.target, a.state.target)
        val b = say(a.state, "이십오십오", "<maum_0>(command=set_angles, purpose=none, head=25, leg=15, confirm=yes)<maum_end>")
        assertEquals(Rules.ANGLE_PAUSE, b.say)
        val c = say(b.state, "이십오 십오 해 줘", "<maum_0>(command=set_angles, purpose=none, head=25, leg=15, confirm=no)<maum_end>")
        assertEquals(Angles(25.0, 15.0), c.state.target); assertEquals(0, c.state.angleAsks)
        // 뭉개진 숫자는 다시 말해 달라고 한다
        val m = say(flat, "팔백칠십 해 줘", "<maum_0>(command=set_angles, purpose=none, head=80, leg=70, confirm=no)<maum_end>")
        assertEquals(Rules.ANGLE_AGAIN, m.say); assertEquals(flat.target, m.state.target)
        // 부위 순서를 바꿔 말하면 모델 값
        val o = say(flat, "다리 삼십 머리 이십으로 해 줘", "<maum_0>(command=set_angles, purpose=none, head=20, leg=30, confirm=no)<maum_end>")
        assertEquals(Angles(20.0, 30.0), o.state.target)
    }

    @Test fun oneAngleForPresetAsksBoth() {
        val t = say(flat, "독서 자세 삼십으로 저장해", "<maum_0>(command=set_angles, purpose=read, head=30, leg=none, confirm=no)<maum_end>")
        assertEquals("angles", t.state.pending?.kind); assertNull(t.state.memory[Purpose.READ])
        val u = say(t.state, "삼십 이십", "<maum_0>(command=set_angles, purpose=none, head=30, leg=20, confirm=no)<maum_end>")
        assertEquals(Angles(30.0, 20.0), u.state.memory[Purpose.READ]); assertEquals(flat.target, u.state.target)
    }

    @Test fun volumeTenLevels() {
        val s = flat.copy(volume = 8)
        assertEquals(6, say(s, "소리 두 칸 낮춰", "<maum_0>(command=set_volume, volume=down, step=2)<maum_end>").state.volume)
        assertEquals(10, say(s, "소리 많이 키워", "<maum_0>(command=set_volume, volume=up, step=large)<maum_end>").state.volume)
        assertEquals(3, say(s, "소리 삼 단계로", "<maum_0>(command=set_volume, volume=set, step=3)<maum_end>").state.volume)
        assertEquals(7, say(s, "소리 줄여", "<maum_0>(command=set_volume, volume=down, step=none)<maum_end>").state.volume)
        assertEquals(1, say(s, "제일 작게", "<maum_0>(command=set_volume, volume=min, step=none)<maum_end>").state.volume)
    }
}
