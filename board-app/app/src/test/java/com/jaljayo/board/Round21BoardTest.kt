package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.DayOfWeek
import java.time.LocalTime

// 11/14 보드 시험에서 나온 문제: 시각으로 답한 오전·오후 확인, 센서 없는 침대 이탈 알람, 순서 말, "음" 대답, 숫자 읽기
class Round21BoardTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private var nowMs = 1_800_000_000_000L   // 한국 시간 2027년 1월 15일 금요일 오후 5시
    private val brain = Brain { nowMs }
    private fun say(s: BedState, heard: String, out: String): Turn {
        val r = spec.parse(Spec.upgrade(out))
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handleSafely(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private val flat = BedState(timeValid = true)
    private val every = DayOfWeek.entries.toSet()
    private fun setAlarm(t: String, ap: String = "none") =
        "<maum_1>(command=set, date=none, ampm=$ap, time=$t, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>"

    @Test fun timeAnswerToAmPmGuessReconfirmsThatTime() {
        val q = say(flat, "알람 9시 40분에 맞춰줘", setAlarm("09:40"))
        assertTrue(q.say, q.say.endsWith("아홉 시 사십 분인가요?"))
        val r = say(q.state, "9시 4분", "<maum_2>(type=time, value=09:04)<maum_end>")
        assertTrue(r.say, r.say.endsWith("아홉 시 사 분인가요?"))
        assertFalse(r.say, r.say.contains("오전인지 오후인지"))
        // 오전·오후까지 말하면 바로 맞춘다
        val r2 = say(q.state, "오전 9시 4분", "<maum_2>(type=time, value=am_09:04)<maum_end>")
        assertEquals(LocalTime.of(9, 4), r2.state.alarms.single().time)
    }

    @Test fun leaveBedAlarmWithoutSensorWarns() {
        val out = "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=leave_bed, repeat=none, days=none, confirm=no)<maum_end>"
        val no = say(flat.copy(sensorOk = false), "오전 일곱 시 침대에서 나와야 꺼지는 알람", out)
        assertTrue(no.say, no.say.endsWith(Rules.NO_SENSOR_LEAVE))
        val ok = say(flat, "오전 일곱 시 침대에서 나와야 꺼지는 알람", out)
        assertFalse(ok.say, ok.say.contains("센서"))
    }

    @Test fun orderWordsPickFromTwoOptions() {
        val s = flat.copy(alarms = listOf(AlarmItem(1, LocalTime.of(9, 19), every)), lastAlarmId = 1)
        val q = say(s, "알람 종류 바꿔 줘", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("alarm_type", q.state.pending?.kind)
        for (w in listOf("전자", "앞에 거", "앞엣것", "첫 번째 거", "처음 거요")) {
            val t = brain.pickByOrder(q.state, w)
            assertEquals(w, "leave_bed", t?.state?.alarms?.single { it.id == 1 }?.type)
        }
        for (w in listOf("후자", "뒤에 거", "마지막 거", "두 번째", "나중 거")) {
            val t = brain.pickByOrder(q.state, w)
            assertEquals(w, "question", t?.state?.alarms?.single { it.id == 1 }?.type)
        }
        assertNull(brain.pickByOrder(q.state, "앞으로"))
        assertNull(brain.pickByOrder(flat, "전자"))   // 묻는 게 없으면 모델에 맡긴다
    }

    @Test fun mumbleIsYesOnlyAfterYesNoQuestion() {
        val q = say(flat.copy(angles = Angles(25.0, 0.0), target = Angles(25.0, 0.0)), "지금 자세 독서 자세로 저장해 줘",
            "<maum_0>(command=set_default, purpose=read, confirm=no)<maum_end>")
        assertTrue(q.say, q.say.endsWith("저장할까요?"))
        assertTrue(brain.mumbleYes(q.state, "음"))
        assertTrue(brain.mumbleYes(q.state, "엉"))
        assertFalse(brain.mumbleYes(q.state, "음 글쎄"))
        assertFalse(brain.mumbleYes(flat, "음"))
    }

    @Test fun spokenAnglesHaveNoDigits() {
        val t = say(flat.copy(angles = Angles(25.0, 0.0), target = Angles(25.0, 0.0)), "지금 각도 몇 도야", "<maum_4>(command=tell_angles, part=none, purpose=none)<maum_end>")
        val spoken = Brain.speakable(t.say)
        assertEquals("지금 머리는 이십오 도, 다리는 영 도예요", spoken)
        assertFalse(Regex("\\d").containsMatchIn(spoken))
    }

    @Test fun minuteFixedFromHeardText() {
        val out = setAlarm("09:40", "am")
        assertEquals(setAlarm("09:04", "am"), brain.fixMinute("오전 아홉 시 사 분 알람 맞춰 줘", out))
        assertEquals(setAlarm("09:42", "am"), brain.fixMinute("오전 아홉 시 사십이 분에 알람 맞춰 줘", out))
        assertEquals(out, brain.fixMinute("오전 아홉 시 사십 분에 알람 맞춰 줘", out))      // 같으면 그대로
        assertEquals(out, brain.fixMinute("아홉 시 사 분이랑 열 시 알람", out))            // 시각이 둘이면 손대지 않음
        assertEquals(out, brain.fixMinute("일곱 시 사 분 전에 깨워 줘", out))             // 시가 다르고 "전"
        val ans = "<maum_2>(type=time, value=09:40)<maum_end>"
        assertEquals("<maum_2>(type=time, value=09:04)<maum_end>", brain.fixMinute("아홉 시 사 분", ans))
    }

    @Test fun minuteOnlyAnswerReconfirms() {
        val q = say(flat, "알람 9시 40분에 맞춰줘", setAlarm("09:40"))
        val r = say(q.state, "사 분", "<maum_2>(type=duration, value=00:04)<maum_end>")
        assertTrue(r.say, r.say.endsWith("아홉 시 사 분인가요?"))
    }

    @Test fun nearWakeWords() {
        for (w in listOf("잘 돼요", "저져요", "잘아요", "잘 다요", "살자요", "잘 자요")) assertTrue(w, com.jaljayo.board.brain.Hearing.wake(w).woke)
        for (w in listOf("좋아요", "그래요", "아니요", "잘 자요 머리 올려 줘".drop(100), "자요")) assertFalse(w, w.isNotEmpty() && com.jaljayo.board.brain.Hearing.nearWake(w))
    }

    @Test fun missingAlarmAnsweredBeforeAskingType() {
        val s = flat.copy(alarms = listOf(AlarmItem(1, LocalTime.of(21, 42), every)))
        val t = say(s, "오후 아홉 시 사십 분 알람 다른 종류로 바꿔 줘", "<maum_1>(command=change_type, target=09:40, target_ampm=pm, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertFalse(t.say, t.say.startsWith("어떤 알람으로 바꿀까요"))
        val t2 = say(s, "오후 아홉 시 사십이 분 알람 다른 종류로 바꿔 줘", "<maum_1>(command=change_type, target=09:42, target_ampm=pm, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(t2.say, t2.say.startsWith("어떤 알람으로 바꿀까요"))
    }
}
