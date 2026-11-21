package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Spec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// 11/18 결정: 말로 바꾸는 각도는 5도 단위. "삼십이로/삼십으로"는 같은 30도, 대답은 실제 각도
class Board1118Test {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 0L }
    private val mid = BedState(angles = Angles(30.0, 20.0), target = Angles(30.0, 20.0))
    private fun cmd(o: String) = spec.parse(Spec.upgrade(o)).let { assertTrue("$o -> $it", it is Spec.Result.Ok); (it as Spec.Result.Ok).cmd }
    private fun run(s: BedState, heard: String, o: String) = brain.handleSafely(s, heard, cmd(o), o)

    @Test fun targetSnaps() {
        val o = "<maum_0>(command=adjust, part=head, direction=none, amount=32, amount_type=target, confirm=no)<maum_end>"
        val t = run(mid, "머리 삼십이로 올려 줘", o)
        assertEquals(Angles(30.0, 20.0), t.state.target)
        val o2 = "<maum_0>(command=adjust, part=head, direction=none, amount=33, amount_type=target, confirm=no)<maum_end>"
        val t2 = run(mid, "머리 삼십삼 도로", o2)
        assertEquals(35.0, t2.state.target.head, 0.0)
        assertEquals("머리를 35도로 맞췄어요", t2.state.after)
    }

    @Test fun deltaSnapsAndHonestWording() {
        val odd = BedState(angles = Angles(23.0, 20.0), target = Angles(23.0, 20.0))
        val o = "<maum_0>(command=adjust, part=head, direction=up, amount=10, amount_type=delta, confirm=no)<maum_end>"
        val t = run(odd, "머리 십 도 올려 줘", o)
        assertEquals(35.0, t.state.target.head, 0.0)
        assertEquals("머리를 12도 올렸어요", t.state.after)
    }

    @Test fun setAnglesSnapNotMax() {
        val o = "<maum_0>(command=set_angles, purpose=none, head=32, leg=17, confirm=no)<maum_end>"
        val t = run(mid, "머리 삼십이 도 다리 십칠 도로 맞춰 줘", o)
        assertEquals(Angles(30.0, 15.0), t.state.target)
        assertEquals("머리 30도, 다리 15도로 맞췄어요", t.state.after)
    }
}
