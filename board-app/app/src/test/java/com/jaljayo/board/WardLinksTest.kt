package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedSim
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.net.WardLinks
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// 11/17 병원 시연: 보드 하나에 침대 제어부를 침대 이름마다 따로 붙인다(docs/ward-multi-bed-design.md)
class WardLinksTest {
    private val sent = mutableListOf<Pair<String, JSONObject>>()
    private val links = WardLinks<String> { c, o -> sent += c to o }
    private val zero = Angles(0.0, 0.0)

    @Test fun namedHelloRoutesCommandsToThatBedOnly() {
        links.hello("사과", "c1", zero, zero); links.hello("포도", "c2", zero, zero)
        sent.clear()
        val s = BedState(name = "포도", ward = true, target = Angles(30.0, 0.0))
        WardLinks.step(s, links.link("포도"), links.lost("포도"), BedSim(), 0.05)
        assertEquals(1, sent.size)
        assertEquals("c2", sent[0].first); assertEquals("bed-move", sent[0].second.getString("type")); assertEquals(30.0, sent[0].second.getDouble("head"), 0.0)
        assertEquals("포도", links.nameOf("c2")); assertEquals("사과", links.nameOf("c1")); assertNull(links.nameOf("c3"))
    }

    @Test fun helloSnapsToThatBedsAngles() {
        links.hello("딸기", "c3", Angles(25.0, 40.0), Angles(25.0, 40.0))
        val m = sent.single().second
        assertTrue(m.getBoolean("snap")); assertEquals(25.0, m.getDouble("head"), 0.0); assertEquals(40.0, m.getDouble("leg"), 0.0)
    }

    @Test fun sameNameReplacesOldConnection() {
        assertNull(links.hello("사과", "old", zero, zero))
        assertEquals("old", links.hello("사과", "new", zero, zero))
        assertEquals("사과", links.nameOf("new")); assertNull(links.nameOf("old"))
        assertNull("예전 접속이 끊겨도 새 접속은 그대로", links.left("old"))
        assertTrue(links.linked("사과"))
    }

    @Test fun linkedBedUsesReturnedAngles() {
        links.hello("사과", "c1", zero, zero)
        links.link("사과")!!.read(JSONObject("""{"type":"bed-state","id":2,"head":12.5,"leg":3.0,"result":null}"""))
        val s = WardLinks.step(BedState(target = Angles(30.0, 0.0)), links.link("사과"), false, BedSim(), 0.05)
        assertEquals(12.5, s.angles.head, 0.0); assertEquals(3.0, s.angles.leg, 0.0)
    }

    @Test fun lostBedFreezesInsteadOfSimulating() {
        links.hello("사과", "c1", zero, zero)
        assertEquals("사과", links.left("c1"))
        assertTrue(links.lost("사과"))
        val s = WardLinks.step(BedState(angles = Angles(10.0, 0.0), target = Angles(30.0, 0.0), after = "머리를 올렸어요"), null, links.lost("사과"), BedSim(), 0.05)
        assertFalse(s.moving); assertEquals(10.0, s.angles.head, 0.0); assertEquals("", s.after)
    }

    @Test fun neverLinkedBedStillSimulates() {
        assertFalse(links.lost("포도"))
        val s = WardLinks.step(BedState(target = Angles(30.0, 0.0)), null, links.lost("포도"), BedSim(), 1.0)
        assertEquals(6.0, s.angles.head, 1e-9)
    }

    @Test fun stoppedResultBecomesNewTarget() {
        links.hello("사과", "c1", zero, zero)
        var finished = ""
        val l = links.link("사과")!!
        l.read(JSONObject("""{"type":"bed-state","id":2,"head":8.0,"leg":0.0,"result":"stopped"}"""))
        val s = WardLinks.step(BedState(target = Angles(30.0, 0.0), after = "머리를 올렸어요"), l, false, BedSim(), 0.05) { finished = it }
        assertFalse(s.moving); assertEquals(8.0, s.target.head, 0.0); assertEquals("stopped", finished)
    }

    @Test fun retainDropsBedsNotInRoom() {
        links.hello("사과", "c1", zero, zero); links.hello("복숭아", "c9", zero, zero)
        assertEquals(listOf("c9"), links.retain(listOf("사과", "포도", "딸기")))
        assertTrue(links.linked("사과")); assertFalse(links.linked("복숭아")); assertFalse(links.lost("복숭아"))
    }

    @Test fun wardEntryHasPerBedFields() {
        val now = LocalDateTime.of(2026, 11, 17, 15, 0).atZone(KST).toInstant().toEpochMilli()
        val b = BedState(name = "포도", ward = true, angles = Angles(24.46, 12.04), target = Angles(30.0, 20.0), purpose = Purpose.READ,
            memory = mapOf(Purpose.READ to Angles(50.0, 15.0)),
            alarms = listOf(AlarmItem(id = 1, time = LocalTime.of(7, 0), onceDate = LocalDate.of(2026, 11, 18))))
        val o = WardLinks.entry("포도", b, active = false, linked = true, nowMs = now)
        assertEquals("포도", o.getString("name")); assertFalse(o.getBoolean("active")); assertTrue(o.getBoolean("linked"))
        assertEquals(24, o.getInt("head")); assertEquals(24.5, o.getJSONObject("angles").getDouble("head"), 0.0); assertEquals(12.0, o.getJSONObject("angles").getDouble("leg"), 0.0)
        assertEquals(30.0, o.getJSONObject("target").getDouble("head"), 0.0); assertTrue(o.getBoolean("moving"))
        assertEquals("read", o.getString("purpose")); assertFalse(o.getBoolean("asking")); assertFalse(o.getBoolean("ringing")); assertTrue(o.isNull("ringingType"))
        assertTrue(o.isNull("reservation")); assertEquals(1, o.getJSONArray("alarms").length())
        assertEquals(50.0, o.getJSONObject("presets").getJSONObject("read").getDouble("head"), 0.0); assertTrue(o.getJSONObject("presets").isNull("tv"))
    }

    @Test fun ringNowRingsNextAlarmOnceWithoutDoubleRing() {
        val nowMs = LocalDateTime.of(2026, 11, 17, 15, 0).atZone(KST).toInstant().toEpochMilli()
        var clock = nowMs
        val brain = Brain { clock }
        val s = BedState(alarms = listOf(AlarmItem(id = 1, time = LocalTime.of(7, 0), onceDate = LocalDate.of(2026, 11, 18)),
            AlarmItem(id = 2, time = LocalTime.of(16, 0), onceDate = LocalDate.of(2026, 11, 17))))
        val t = brain.ringNow(s)!!
        assertEquals(2, t.state.ringing!!.id)
        assertNull("울리는 중이면 또 울리지 않는다", brain.ringNow(t.state))
        // 실제 16시가 와도 이미 울린 회차라 다시 울리지 않는다
        clock = LocalDateTime.of(2026, 11, 17, 16, 0, 30).atZone(KST).toInstant().toEpochMilli()
        assertNull(brain.dueAlarm(t.state.copy(ringing = null)))
    }
}
