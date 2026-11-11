package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedSim
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.net.AppApi
import com.jaljayo.board.net.BedLink
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class LinkTest {
    private val today = LocalDate.of(2026, 11, 9)
    private val api = AppApi()
    private fun j(s: String) = JSONObject(s)

    @Test fun simulationSpeedIsSixDegreesPerSecond() {
        val a = BedSim().step(Angles(0.0, 0.0), Angles(60.0, 40.0), 1.0)
        assertEquals(6.0, a.head, 1e-9); assertEquals(6.0, a.leg, 1e-9)
    }

    @Test fun targetChangeSendsMoveOnceAndStopWhenTargetIsCurrent() {
        val out = mutableListOf<JSONObject>()
        val l = BedLink { out.add(it) }
        l.start(Angles(0.0, 0.0), Angles(0.0, 0.0))
        assertTrue(out[0].getBoolean("snap"))
        l.sync(Angles(0.0, 0.0), Angles(30.0, 20.0)); l.sync(Angles(1.0, 1.0), Angles(30.0, 20.0))
        assertEquals(2, out.size); assertEquals("bed-move", out[1].getString("type")); assertEquals(30.0, out[1].getDouble("head"), 0.0)
        l.sync(Angles(10.0, 5.0), Angles(10.0, 5.0))
        assertEquals("bed-stop", out[2].getString("type"))
    }

    @Test fun finishedResultIsTakenOnceAndAcceptedTargetSendsNothing() {
        val out = mutableListOf<JSONObject>()
        val l = BedLink { out.add(it) }
        l.start(Angles(0.0, 0.0), Angles(30.0, 20.0))
        l.read(j("""{"head":12.5,"leg":3,"result":"stopped"}"""))
        assertEquals(Angles(12.5, 3.0), l.latest)
        assertEquals("stopped", l.takeFinished()!!.result); assertNull(l.takeFinished())
        l.accept(Angles(12.5, 3.0)); val n = out.size
        l.sync(Angles(12.5, 3.0), Angles(12.5, 3.0)); assertEquals(n, out.size)
    }

    @Test fun moveIsClampedAndRefusedWhileNothingElse() {
        val r = api.handle(BedState(), "bed-move", j("""{"head":99,"leg":-3}"""), today, emptyMap())
        assertEquals(Angles(60.0, 0.0), r.state.target); assertTrue(r.reply!!.getBoolean("ok"))
    }

    @Test fun unknownRequestHasNoReply() {
        assertNull(api.handle(BedState(), "wifi-set", j("{}"), today, emptyMap()).reply)
    }

    private val draft = """{"time":450,"days":[1,2,3,4,5],"dateOff":null,"way":"q2","volume":3,"lift":true,"skipOff":2,"pauseTo":null,"pauseDays":null,"exc":{"3":{"drop":true}}}"""

    @Test fun alarmSaveThenAppStateRoundTrips() {
        val r = api.handle(BedState(), "alarm-save", j("""{"id":null,"draft":$draft,"overwrite":[]}"""), today, emptyMap())
        val a = r.state.alarms.single()
        assertEquals(1, a.id); assertEquals("question", a.type); assertEquals(2, a.level)
        assertEquals(setOf(today.plusDays(2), today.plusDays(3)), a.skips)
        val app = api.appState(r.state, today, r.extras, 0).getJSONArray("alarms").getJSONObject(0)
        assertEquals(450, app.getInt("time")); assertEquals("q2", app.getString("way")); assertEquals(3, app.getInt("volume"))
        assertTrue(app.getBoolean("lift")); assertEquals(5, app.getJSONArray("days").length())
    }

    @Test fun sundayIsZeroBothWays() {
        val d = draft.replace("[1,2,3,4,5]", "[0]")
        val r = api.handle(BedState(), "alarm-save", j("""{"id":null,"draft":$d}"""), today, emptyMap())
        assertEquals(java.time.DayOfWeek.SUNDAY, r.state.alarms.single().days.single())
        assertEquals(0, api.appState(r.state, today, r.extras, 0).getJSONArray("alarms").getJSONObject(0).getJSONArray("days").getInt(0))
    }

    @Test fun togglingKeepsAlarmAndOverwriteRemovesOnce() {
        val once = draft.replace("[1,2,3,4,5]", "[]").replace("\"dateOff\":null", "\"dateOff\":1")
        val a = api.handle(BedState(), "alarm-save", j("""{"id":null,"draft":$once}"""), today, emptyMap())
        val off = api.handle(a.state, "alarm-save", j("""{"id":1,"on":false}"""), today, a.extras)
        assertFalse(off.state.alarms.single().enabled)
        val b = api.handle(off.state, "alarm-save", j("""{"id":null,"draft":$once,"overwrite":[1]}"""), today, off.extras)
        assertEquals(listOf(2), b.state.alarms.map { it.id })
    }

    @Test fun reservationNeedsClockAndKeepsAngleOnlyAsNull() {
        val body = j("""{"time":1390,"off":0,"purpose":null,"head":20,"leg":5}""")
        assertFalse(api.handle(BedState(timeValid = false), "resv-save", body, today, emptyMap()).reply!!.getBoolean("ok"))
        val r = api.handle(BedState(), "resv-save", body, today, emptyMap())
        val now = today.atStartOfDay(com.jaljayo.board.brain.KST).toInstant().toEpochMilli()
        val o = api.appState(r.state, today, r.extras, now).getJSONObject("resv")
        assertTrue(o.isNull("purpose")); assertEquals(1390, o.getInt("time")); assertEquals(0, o.getInt("off"))
    }

    @Test fun poseSaveAppearsInPresets() {
        val r = api.handle(BedState(), "pose-save", j("""{"preset":"read","head":40,"leg":12}"""), today, emptyMap())
        val p = api.appState(r.state, today, r.extras, 0).getJSONObject("presets")
        assertEquals(40.0, p.getJSONObject("read").getDouble("head"), 0.0); assertTrue(p.isNull("tv"))
    }
}
