package com.jaljayo.board

import com.jaljayo.board.brain.BedState
import com.jaljayo.board.net.AppApi
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalTime

// 11/14: 폰 앱 알람의 소리 크기·상체 올림·이번만 회차를 보드가 장부에 넣어 울릴 때 쓴다
class AlarmExtrasTest {
    private val today = LocalDate.of(2026, 11, 16)   // 월요일
    private val api = AppApi()
    private fun j(s: String) = JSONObject(s)
    // 평일 7시 반, 내일(화)만 8시 기본 알람으로, 모레(수)는 안 울림
    private val draft = """{"time":450,"days":[1,2,3,4,5],"dateOff":null,"way":"q2","volume":3,"lift":true,"skipOff":null,"pauseTo":null,"pauseDays":null,
        "exc":{"1":{"time":480,"way":"basic"},"2":{"drop":true}}}"""

    private fun saved() = api.handle(BedState(), "alarm-save", j("""{"id":null,"draft":$draft,"overwrite":[]}"""), today, emptyMap())

    @Test fun volumeAndLiftGoIntoAlarm() {
        val a = saved().state.alarms.first { it.parent == null }
        assertEquals(3, a.volume); assertTrue(a.lift)
    }

    @Test fun onceChangeMakesHiddenOneTimeAlarmAndSkipsThatDay() {
        val r = saved()
        val main = r.state.alarms.single { it.parent == null }
        val kid = r.state.alarms.single { it.parent != null }
        assertEquals(main.id, kid.parent); assertEquals(today.plusDays(1), kid.onceDate); assertEquals(LocalTime.of(8, 0), kid.time)
        assertEquals("basic", kid.type); assertEquals(3, kid.volume); assertTrue(kid.lift)
        assertFalse(main.ringsOn(today.plusDays(1))); assertFalse(main.ringsOn(today.plusDays(2))); assertTrue(main.ringsOn(today.plusDays(3)))
        // 폰에는 원래 알람 하나만, 이번만 회차는 exc로, 건너뛰기로는 안 보임
        val app = api.appState(r.state, today, r.extras, 0).getJSONArray("alarms")
        assertEquals(1, app.length())
        val o = app.getJSONObject(0)
        assertTrue(o.isNull("skipOff")); assertEquals(480, o.getJSONObject("exc").getJSONObject("1").getInt("time"))
    }

    @Test fun excDaysStayOnTheSameDateNextDay() {
        val r = saved()
        val o = api.appState(r.state, today.plusDays(1), r.extras, 0).getJSONArray("alarms").getJSONObject(0).getJSONObject("exc")
        assertEquals(480, o.getJSONObject("0").getInt("time")); assertTrue(o.getJSONObject("1").getBoolean("drop"))
    }

    @Test fun resaveReplacesOnceAlarmAndDeleteRemovesIt() {
        val r = saved()
        val id = r.state.alarms.single { it.parent == null }.id
        val plain = draft.replace(""""1":{"time":480,"way":"basic"},""", "")
        val r2 = api.handle(r.state, "alarm-save", j("""{"id":$id,"draft":$plain}"""), today, r.extras)
        assertEquals(1, r2.state.alarms.size)
        val r3 = api.handle(r.state, "alarm-delete", j("""{"id":$id}"""), today, r.extras)
        assertTrue(r3.state.alarms.isEmpty())
    }

    @Test fun toggleAlsoTogglesOnceAlarm() {
        val r = saved()
        val id = r.state.alarms.single { it.parent == null }.id
        val off = api.handle(r.state, "alarm-save", j("""{"id":$id,"on":false}"""), today, r.extras)
        assertTrue(off.state.alarms.all { !it.enabled }); assertEquals(2, off.state.alarms.size)
    }

    @Test fun storeKeepsNewFields() {
        val f = File.createTempFile("store", ".json"); f.delete()
        val s = saved().state
        Store(f).save(s)
        val back = Store(f).load(BedState())
        assertEquals(s.alarms, back.alarms)
        f.delete()
    }
}
