package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import com.jaljayo.board.model.Prompt
import com.jaljayo.board.model.PromptFormat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

// 모델 입력 문장: [앞 질문]에는 두뇌가 실제로 말한 질문을 그대로, 기다리는 질문이 없으면 "없음"을 넣는다
class PromptTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private var nowMs = LocalDateTime.of(2026, 10, 27, 6, 0).atZone(KST).toInstant().toEpochMilli()
    private val brain = Brain { nowMs }
    private val head = "Below is the query from the users, please choose the correct function and generate the parameters to call the function. Query: "

    // 보드 앱과 같이: 모델 출력을 검사해 두뇌에 넣고, 말하기 전에 질문 문장을 적어 둔다
    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out) as Spec.Result.Ok
        return brain.recordAsked(s, brain.handle(s, heard, r.cmd, out))
    }
    // 앞 질문 시험은 WITH_QUESTION 모양으로 본다. 상태 넣는 모양은 아래 상태 시험에서 본다
    private fun prompt(s: BedState, text: String) = Prompt.build(text, brain.waitingQuestion(s), format = PromptFormat.WITH_QUESTION)

    @Test fun defaultFormatIsWithStatus() {
        assertEquals(PromptFormat.WITH_STATUS, Prompt.FORMAT)
    }

    @Test fun statusFormat() {
        assertEquals("${head}[상태] 없음 [앞 질문] 없음 [말] 머리 올려 Response:", Prompt.build("머리 올려", null, brain.status(BedState())))
        assertEquals("${head}[상태] 알람 울리는 중 [앞 질문] 몇 시에 맞출까요? [말] 일곱 시 Response:",
            Prompt.build("일곱 시", "몇 시에 맞출까요?", Brain.STATUS_RINGING))
        assertEquals("${head}[상태] 없음 [앞 질문] 없음 [말] 머리 올려 Response:", Prompt.build("머리 올려", null))
    }

    @Test fun statusNone() {
        assertEquals("없음", brain.status(BedState()))
    }

    @Test fun statusRinging() {
        var s = say(BedState(), "일곱 시 반에 깨워", "<maum_1>(command=set, date=none, ampm=am, time=07:30, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state
        nowMs += 91 * 60_000L
        s = brain.recordAsked(s, brain.dueAlarm(s)!!).state
        assertTrue(s.ringing != null && !s.moving)
        assertEquals("알람 울리는 중", brain.status(s))
    }

    @Test fun statusAdditionQuestion() {
        var s = say(BedState(), "덧셈 알람으로 일곱 시 반에 깨워", "<maum_1>(command=set, date=none, ampm=am, time=07:30, time_type=absolute, type=question, repeat=none, days=none, confirm=no)<maum_end>").state
        nowMs += 91 * 60_000L
        s = brain.recordAsked(s, brain.dueAlarm(s)!!).state
        val b = brain.recordAsked(s, brain.alarmButton(s, java.util.Random(1))!!).state
        assertTrue(b.question != null)
        assertEquals("알람 울리는 중", brain.status(b))
    }

    @Test fun statusMoving() {
        val s = say(BedState(), "머리 십 도 올려", "<maum_0>(command=adjust, part=head, direction=up, amount=10, amount_type=delta, confirm=no)<maum_end>").state
        assertTrue(s.moving && s.ringing == null)
        assertEquals("침대 움직이는 중", brain.status(s))
    }

    @Test fun statusBoth() {
        var s = say(BedState(), "일곱 시 반에 깨워", "<maum_1>(command=set, date=none, ampm=am, time=07:30, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>").state
        nowMs += 91 * 60_000L
        s = brain.recordAsked(s, brain.dueAlarm(s)!!).state
        s = s.copy(target = Angles(s.angles.head + 10.0, s.angles.leg))
        assertTrue(s.ringing != null && s.moving)
        assertEquals("알람 울리는 중", brain.status(s))
    }

    @Test fun oldFormatKeepsQueryOnly() {
        assertEquals("${head}머리 올려 Response:", Prompt.build("머리 올려", "몇 시에 맞출까요?", format = PromptFormat.QUERY_ONLY))
    }

    @Test fun noQuestion() {
        val s = BedState()
        assertNull(brain.waitingQuestion(s))
        assertEquals("${head}[앞 질문] 없음 [말] 머리 올려 Response:", prompt(s, "머리 올려"))
    }

    @Test fun postureQuestion() {
        val t = say(BedState(), "이 자세 저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        assertEquals("어느 자세로 저장할까요? 독서, TV, 휴식, 잠 중에 말해 주세요", t.say)
        assertEquals("${head}[앞 질문] ${t.say} [말] 독서 Response:", prompt(t.state, "독서"))
        // 이름을 받으면 저장 확인을 새로 묻고, 앞 질문도 그 문장으로 바뀐다
        val y = say(t.state, "독서", "<maum_2>(type=purpose, value=read)<maum_end>")
        assertEquals("지금 자세를 독서 기본 자세로 저장할까요?", y.say)
        assertEquals("${head}[앞 질문] ${y.say} [말] 응 Response:", prompt(y.state, "응"))
        val n = say(y.state, "아니", "<maum_2>(type=no, value=none)<maum_end>")
        assertEquals("${head}[앞 질문] 없음 [말] 머리 올려 Response:", prompt(n.state, "머리 올려"))
    }

    @Test fun alarmChoiceQuestion() {
        var s = say(BedState(), "평일 오전 일곱 시 알람 맞춰",
            "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>").state
        assertEquals("${head}[앞 질문] 없음 [말] 알람 꺼 Response:", prompt(s, "알람 꺼"))
        s = say(s, "주말 여덟 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>").state
            .copy(lastAlarmId = null)
        val t = say(s, "알람 꺼", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertTrue(t.say, t.say.endsWith("어떤 알람을 끌까요?"))
        assertEquals("${head}[앞 질문] ${t.say} [말] 평일 거 Response:", prompt(t.state, "평일 거"))
        val a = say(t.state, "평일 거", "<maum_2>(command=select_alarm, target=none, target_ampm=none, target_days=weekdays, date=none, target_type=none, target_order=none)<maum_end>")
        assertNull(a.state.pending)
        assertEquals("${head}[앞 질문] 없음 [말] 고마워 Response:", prompt(a.state, "고마워"))
    }

    @Test fun reaskReplacesQuestion() {
        val t = say(BedState(), "알람 맞춰 줘", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertEquals("몇 시에 맞출까요?", brain.waitingQuestion(t.state))
        val r = brain.recordAsked(t.state, brain.reask(t.state, "글쎄")!!)
        assertEquals(r.say, brain.waitingQuestion(r.state))
        assertEquals("${head}[앞 질문] ${r.say} [말] 일곱 시 Response:", prompt(r.state, "일곱 시"))
    }

    @Test fun additionQuestion() {
        var s = say(BedState(), "덧셈 알람으로 일곱 시 반에 깨워", "<maum_1>(command=set, date=none, ampm=am, time=07:30, time_type=absolute, type=question, repeat=none, days=none, confirm=no)<maum_end>").state
        nowMs += 91 * 60_000L
        s = brain.recordAsked(s, brain.dueAlarm(s)!!).state
        assertNull(brain.waitingQuestion(s))  // 울리기만 하고 아직 문제를 내지 않음
        val b = brain.recordAsked(s, brain.alarmButton(s, java.util.Random(1))!!)
        assertTrue(b.say.endsWith("는 얼마예요?"))
        assertEquals("${head}[앞 질문] ${b.say} [말] 십오 Response:", prompt(b.state, "십오"))
        val wrong = say(b.state, "모르겠는데 백", "<maum_2>(type=number, value=100)<maum_end>")
        assertTrue(wrong.say.startsWith("다시 생각해 보세요"))
        assertEquals(wrong.say, brain.waitingQuestion(wrong.state))
        val q = b.state.question!!
        val ok = say(wrong.state, "정답은 " + Brain.sino(q.first + q.second), "<maum_2>(type=number, value=${q.first + q.second})<maum_end>")
        assertNull(ok.state.ringing)
        assertEquals("", ok.state.questionSaid)
        assertNull(brain.waitingQuestion(ok.state))
    }
}
