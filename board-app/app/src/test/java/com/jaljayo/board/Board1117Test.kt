package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// 11/17 결정: "다 올려·다 내려" 보드에서 정하기, 부른 직후 "됐어"류, 0도 대답 말투
class Board1117Test {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 0L }
    private val mid = BedState(angles = Angles(30.0, 20.0), target = Angles(30.0, 20.0))

    @Test fun allUpBothMax() {
        for (h in listOf("다 올려", "둘 다 올려 줘", "양쪽 다 세워", "전부 올려", "싹 다 올려줘", "몽땅 일으켜", "모두 높여 주세요", "다 끝까지 올려", "머리랑 다리 다 올려", "머리도 다리도 다 올려", "야 다 올려.")) {
            val t = brain.allUpDown(mid, h, null)
            assertTrue(h, t != null)
            assertEquals(h, Rules.LIMIT, t!!.state.target)
        }
    }

    @Test fun allDownBothZero() {
        for (h in listOf("다 내려", "둘 다 내려 줘", "전부 눕혀", "다 펴", "싹 낮춰", "머리랑 다리 둘 다 내려", "다 끝까지 내려")) {
            val t = brain.allUpDown(mid, h, null)
            assertTrue(h, t != null)
            assertEquals(h, Angles(0.0, 0.0), t!!.state.target)
            assertEquals(h, "평평하게 맞췄어요", t.state.after)
        }
    }

    @Test fun prevReplyOnePartOnly() {
        val up = brain.allUpDown(mid, "다 올려", "머리를 10도 올렸어요")!!
        assertEquals(Angles(Rules.LIMIT.head, 20.0), up.state.target)
        val down = brain.allUpDown(mid, "다 내려", "다리를 10도 내렸어요")!!
        assertEquals(Angles(30.0, 0.0), down.state.target)
        assertEquals("다리를 끝까지 내렸어요", down.state.after)
        // 두 부위를 말한 대답 뒤나, 머리·다리를 둘 다 말하면 둘 다
        assertEquals(Angles(0.0, 0.0), brain.allUpDown(mid, "다 내려", "머리와 다리를 올렸어요")!!.state.target)
        assertEquals(Rules.LIMIT, brain.allUpDown(mid, "머리랑 다리 다 올려", "머리를 10도 올렸어요")!!.state.target)
    }

    @Test fun notAllUpDown() {
        for (h in listOf("다리 내려", "다리 다 내려", "머리 다 올려", "머리랑 다리 올려", "끝까지 올려", "다 올려 놓고 알람 맞춰", "다리를 내려 줘", "올려"))
            assertNull(h, brain.allUpDown(mid, h, null))
        assertNull(brain.allUpDown(mid.copy(ringing = null).let { it }, "다리", null))
    }

    @Test fun dismissList() {
        for (h in listOf("됐어", "됐어 됐어", "아 됐어", "됐다고", "됐다", "관둬라", "그만둬라", "그냥 둬라", "둬", "그냥 둬", "두자", "그냥 두자",
                "아니다", "아니야", "괜찮아", "괜찮아, 됐어", "아니야 됐어", "괜찮아 그냥 둬", "됐어요.", "아니에요", "괜찮아요", "그냥 두세요", "관두세요"))
            assertTrue(h, Brain.isDismiss(h))
        for (h in listOf("다 됐어", "됐어 올려", "아니 다리", "괜찮아 보여", "그만")) assertFalse(h, Brain.isDismiss(h))
    }

    @Test fun quitCmd() {
        fun cmd(o: String) = spec.parse(Spec.upgrade(o)).let { assertTrue("$o -> $it", it is Spec.Result.Ok); (it as Spec.Result.Ok).cmd }
        assertTrue(Brain.isQuitCmd(cmd("<maum_2>(type=cancel, value=none)<maum_end>")))
        assertTrue(Brain.isQuitCmd(cmd("<maum_2>(type=no, value=none)<maum_end>")))
        assertFalse(Brain.isQuitCmd(cmd("<maum_2>(type=yes, value=none)<maum_end>")))
    }

    @Test fun zeroWording() {
        fun cmd(o: String) = spec.parse(Spec.upgrade(o)).let { assertTrue("$o -> $it", it is Spec.Result.Ok); (it as Spec.Result.Ok).cmd }
        val o = "<maum_0>(command=adjust, part=leg, direction=none, amount=0, amount_type=target, confirm=no)<maum_end>"
        assertEquals("다리를 끝까지 내렸어요", brain.handleSafely(mid, "다리 영 도로", cmd(o), o).state.after)
        val o2 = "<maum_0>(command=adjust, part=head, direction=none, amount=10, amount_type=target, confirm=no)<maum_end>"
        assertEquals("머리를 10도로 맞췄어요", brain.handleSafely(mid, "머리 십 도로", cmd(o2), o2).state.after)
    }

    @Test fun stutterUp() {
        assertEquals(Rules.LIMIT, brain.allUpDown(mid, "다 올려려", null)!!.state.target)
        assertEquals(Angles(0.0, 0.0), brain.allUpDown(mid, "다 내려려 줘", null)!!.state.target)
    }

    @Test fun twoAngleDeltaNoRo() {
        val low = BedState(angles = Angles(10.0, 10.0), target = Angles(10.0, 10.0))
        for (h in listOf("머리 십 도 다리 십 도 올려", "십 도 다리 십 도 올려", "머리 10도 다리 10도 올려 줘", "머리 십 다리 십 올려", "십 십 올려려")) {
            val t = brain.twoAngleDelta(low, h)
            assertTrue(h, t != null)
            assertEquals(h, Angles(20.0, 20.0), t!!.state.target)
            assertEquals(h, "머리를 10도, 다리를 10도 올렸어요", t.state.after)
        }
        assertEquals(Angles(30.0, 15.0), brain.twoAngleDelta(low, "다리 오 도 머리 이십 도 올려")!!.state.target)
        assertEquals(Angles(0.0, 5.0), brain.twoAngleDelta(low, "머리 십 도 다리 오 도 내려")!!.state.target)
        // 최대를 넘으면 최대까지만
        assertEquals("머리를 50도, 다리를 30도 올렸어요", brain.twoAngleDelta(low, "머리 육십 도 다리 사십 도 올려")!!.state.after)
    }

    @Test fun twoAngleWithRoNotDelta() {
        for (h in listOf("머리 십 도 다리 십 도로 올려", "머리 삼십 다리 이십으로 맞춰", "삼십 이십 해 줘", "다리 이십 도 올려", "머리 이십 도 올려 줘", "삼십이십 올려"))
            assertNull(h, brain.twoAngleDelta(mid, h))
    }
}
