package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.DayOfWeek
import java.time.LocalTime

// 16차(11/11) 결정: 지금 상태만 말한 불평은 모델이 바로 실행으로 내도 먼저 묻는다. 읽어 준 알람 목록 뒤 "세 개 다 지워"는 그 목록을 지울지 묻는다
class Round16Test {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }
    private val every = DayOfWeek.entries.toSet()
    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0); val r = spec.parse(out)
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun adj(part: String, dir: String, amount: String) =
        "<maum_0>(command=adjust, part=$part, direction=$dir, amount=$amount, amount_type=${if (amount == "none") "none" else "delta"}, confirm=no)<maum_end>"
    private val at = BedState(angles = Angles(30.0, 20.0), target = Angles(30.0, 20.0))

    @Test fun complaintOnlyAsksFirst() {
        for (h in listOf("다리가 좀 낮아", "다리가 좀 떠 있어", "머리가 너무 서 있네", "등이 좀 높은 것 같아", "다리가 처져 있어요")) {
            val t = say(at, h, adj("leg", "down", "small"))
            assertEquals(h, at.target, t.state.target)            // 움직이지 않음
            assertNotNull(h, t.state.pending)
            assertTrue(h + " / " + t.say, t.say.endsWith("?"))
        }
    }

    @Test fun commandWithComplaintStillMoves() {
        for (h in listOf("다리가 좀 낮아 올려 줘", "다리 좀 내려 줘", "머리 좀 낮춰", "다리 좀 내리자", "머리가 너무 높아 좀 내려")) {
            val t = say(at, h, adj("leg", "down", "small"))
            assertEquals(h, 15.0, t.state.target.leg, 0.0)
        }
    }

    @Test fun deleteAllAfterReadingList() {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every), AlarmItem(2, LocalTime.of(8, 0), every), AlarmItem(3, LocalTime.of(9, 0), every)))
        val read = say(s, "알람 뭐 있어", "<maum_4>(command=tell_alarms, date=none, days=none)<maum_end>")
        assertEquals(3, read.state.listed.size)
        val ask = say(read.state, "세 개 다 지워", "<maum_2>(command=request, operation=delete, target=all, date=none, time=none, target_order=none)<maum_end>")
        assertTrue(ask.say, ask.say.contains("모두 삭제할까요"))
        val done = say(ask.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertTrue(done.say, done.state.alarms.isEmpty())
    }

    @Test fun deleteAllWithoutListStillAsks() {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every)))
        assertEquals("무엇을 삭제할까요?", say(s, "세 개 다 지워", "<maum_2>(command=request, operation=delete, target=all, date=none, time=none, target_order=none)<maum_end>").say)
    }
}
