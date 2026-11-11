package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

// 상황별 침대 동작 표의 대표 줄을 그대로 시험한다
class BrainTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }

    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out) as Spec.Result.Ok
        return brain.handle(s, heard, r.cmd, out)
    }
    private fun arrive(s: BedState) = s.copy(angles = s.target)

    @Test fun headUpMovesThenReportsAfter() {
        val t = say(BedState(), "머리 올려", "<maum_0>(command=adjust, part=head, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>")
        assertEquals(Angles(10.0, 0.0), t.state.target)
        assertEquals("", t.say)                                   // 움직이기 전에는 말하지 않음
        assertEquals("머리를 10도 올렸어요", t.state.after)        // 다 움직인 뒤 할 말
    }

    @Test fun wishAsksFirstThenYesRuns() {
        val t = say(BedState(), "머리가 너무 낮네", "<maum_0>(command=adjust, part=head, direction=up, amount=small, amount_type=delta, confirm=yes)<maum_end>")
        assertEquals("머리를 5도 올릴까요?", t.say)
        assertEquals(Angles(0.0, 0.0), t.state.target)            // 동의 전에는 안 움직임
        assertNotNull(t.state.pending)
        val y = say(t.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals(Angles(5.0, 0.0), y.state.target)
        assertEquals("머리를 5도 올렸어요", y.state.after)
        assertNull(y.state.pending)
    }

    @Test fun noEndsQuestionSilently() {
        val t = say(BedState(), "책 보면서 쉬고 싶어", "<maum_0>(command=call, purpose=read, confirm=yes)<maum_end>")
        assertEquals("독서 자세로 바꿀까요?", t.say)
        val n = say(t.state, "아니", "<maum_2>(type=no, value=none)<maum_end>")
        assertEquals("", n.say); assertNull(n.state.pending); assertEquals(Angles(0.0, 0.0), n.state.target)
    }

    @Test fun stopWordStopsWithoutModelAndReportsAngle() {
        val moving = say(BedState(), "머리 삼십 도로 올려 봐", "<maum_0>(command=adjust, part=head, direction=up, amount=30, amount_type=target, confirm=no)<maum_end>").state
            .copy(angles = Angles(18.4, 0.0))
        val t = brain.quickStop(moving, "멈춰")!!
        assertEquals("머리를 18도까지 올리고 멈췄어요", t.say)
        assertEquals(t.state.angles, t.state.target)
        assertEquals("", t.state.after)
        assertNull(brain.quickStop(arrive(moving), "머리 올려"))
    }

    @Test fun missingPartAsksThenAnswerFills() {
        val t = say(BedState(), "끝까지 올려 줘", "<maum_0>(command=adjust, part=none, direction=up, amount=max, amount_type=target, confirm=no)<maum_end>")
        assertEquals("어느 쪽을 맞출까요? 머리, 다리 중에 말해 주세요", t.say)
        val a = say(t.state, "머리", "<maum_2>(type=part, value=head)<maum_end>")
        assertEquals(Angles(60.0, 0.0), a.state.target)
        assertEquals("머리를 최대인 60도까지 올렸어요", a.state.after)
    }

    @Test fun reserveWishAsks() {
        val t = say(BedState(), "삼십분 뒤에 잘 거야", "<maum_0>(command=reserve, purpose=flat, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>")
        assertEquals("삼십 분 뒤에 평평하게 바꾸도록 예약할까요?", t.say)
        val y = say(t.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals("삼십 분 뒤에 평평하게 바꾸도록 예약했어요", y.say)
        assertNotNull(y.state.reservation)
    }

    @Test fun outOfScopeAndChat() {
        assertEquals(Rules.MISHEARD, say(BedState(), "불 좀 꺼", "<maum_3>(reason=out_of_scope)<maum_end>").say)
        assertEquals(Rules.CHAT, say(BedState(), "주스보다 그냥 과일이 좋더라고", "<General_Conversation>()<maum_end>").say)
    }

    private val weekday = "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>"

    // 먼저 묻기는 대답 문장과 상관없이 동의 전에는 바꾸지 않는다(기간 끄기는 문장 뒤에 안내가 붙는다)
    // 시계는 금요일 오후 5시라 사흘(금·토·일)에는 평일 알람이 울릴 회차가 없어 닷새로 시험한다(v0.9: 울릴 회차가 없으면 바꾸지 않고 알림)
    @Test fun disableWithConfirmAsksFirst() {
        val s = say(BedState(), "평일 일곱 시", weekday).state.copy(lastAlarmId = null)
        val out = "<maum_1>(command=disable, target=none, target_ampm=none, target_days=none, start=today, until=none, period=5, target_type=none, target_order=none, confirm=yes)<maum_end>"
        val t = say(s, "닷새 쉬었으면 좋겠어", out)
        assertEquals(s.alarms, t.state.alarms)
        assertEquals("confirm", t.state.pending?.kind)
        assertEquals(true, t.say.endsWith("꺼 둘까요?"))
        val y = say(t.state, "응", "<maum_2>(type=yes, value=none)<maum_end>")
        assertEquals(false, y.state.alarms == s.alarms)
        assertNull(y.state.pending)
    }

    @Test fun delayReservationWithConfirmAsksFirst() {
        val s = say(BedState(), "열한 시 반 잠", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute, confirm=no)<maum_end>").state
        val out = "<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=00:30, time_type=later, confirm=yes)<maum_end>"
        val t = say(s, "예약이 삼십 분 뒤로 밀렸으면", out)
        assertEquals(s.reservation, t.state.reservation)
        assertEquals("confirm", t.state.pending?.kind)
        assertEquals(true, t.say.endsWith("늦출까요?"))
    }

    // 바꾸는 게 없으면 묻지 않고 그대로 답한다
    @Test fun confirmWithNothingToChangeJustAnswers() {
        val t = say(BedState(), "알람 꺼 두면 좋겠어", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=yes)<maum_end>")
        assertEquals("맞춰 둔 알람이 없어요", t.say)
        assertNull(t.state.pending)
    }

    // 시각을 묻는 중 기간 대답이 오면 상태를 그대로 두고 무엇을 말해야 하는지와 같은 질문을 다시 한다
    @Test fun daysAnswerToTimeQuestionAsksAgain() {
        val t = say(BedState(), "알람 맞춰 줘", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        val a = say(t.state.copy(lastSpeech = t.say), "사흘", "<maum_2>(type=duration, value=days_3)<maum_end>")
        assertEquals("시각을 말씀해 주세요. ${t.say}", a.say)
        assertEquals(t.state.pending, a.state.pending)
        assertEquals(t.state.alarms, a.state.alarms)
    }

    // ---------- 삭제 확인 ----------
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"
    private val no = "<maum_2>(type=no, value=none)<maum_end>"
    private val weekend = "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>"
    private fun del(target: String = "07:00", ampm: String = "am", days: String = "none", confirm: String = "no") =
        "<maum_1>(command=delete, target=$target, target_ampm=$ampm, target_days=$days, date=none, state=any, target_type=none, target_order=none, confirm=$confirm)<maum_end>"
    private fun twoAlarms(): BedState {
        val a = say(BedState(), "평일 일곱 시", weekday).state
        return say(a, "주말 여덟 시", weekend).state.copy(lastAlarmId = null)
    }

    @Test fun deleteAsksOnceThenYesDeletes() {
        val s = twoAlarms()
        val t = say(s, "일곱 시 알람 지워", del())
        assertEquals(s.alarms, t.state.alarms)
        assertEquals("delete", t.state.pending?.kind)
        assertEquals(true, t.say.endsWith("알람을 삭제할까요?"))
        val y = say(t.state, "응", yes)
        assertEquals(1, y.state.alarms.size)
        assertEquals(true, y.say.endsWith("삭제했어요"))
        assertNull(y.state.pending)                               // 다시 묻지 않음
    }

    @Test fun deleteNoKeepsAlarm() {
        val s = twoAlarms()
        val n = say(say(s, "일곱 시 알람 지워", del()).state, "아니", no)
        assertEquals(s.alarms, n.state.alarms)
        assertNull(n.state.pending)
    }

    @Test fun deleteWithConfirmAsksOnlyOnce() {
        val s = twoAlarms()
        val t = say(s, "일곱 시 알람 없어도 될 것 같아", del(confirm = "yes"))
        assertEquals("delete", t.state.pending?.kind)
        assertEquals(s.alarms, t.state.alarms)
        val y = say(t.state, "응", yes)
        assertEquals(1, y.state.alarms.size)
        assertNull(y.state.pending)
    }

    @Test fun deleteThatAlarmRequestAsksOnlyOnce() {
        val s = twoAlarms().let { it.copy(lastAlarmId = it.alarms.first().id, lastAlarmUntil = Long.MAX_VALUE) }
        val t = say(s, "그거 지워", "<maum_2>(command=request, operation=delete, target=none, date=none, time=none, target_order=none)<maum_end>")
        assertEquals("delete", t.state.pending?.kind)
        val y = say(t.state, "응", yes)
        assertEquals(1, y.state.alarms.size)
        assertNull(y.state.pending)
    }

    @Test fun deleteAfterChoosingAlarmAsksOnlyOnce() {
        val s = twoAlarms()
        val t = say(s, "알람 지워", del(target = "none", ampm = "none"))
        assertEquals("alarm", t.state.pending?.kind)
        val c = say(t.state, "일곱 시", "<maum_2>(type=time, value=am_07:00)<maum_end>")
        assertEquals("delete", c.state.pending?.kind)
        assertEquals(s.alarms, c.state.alarms)
        assertEquals(1, say(c.state, "응", yes).state.alarms.size)
    }

    @Test fun deleteAllSaysCount() {
        val s = twoAlarms()
        val t = say(s, "알람 전부 지워", del(target = "all", ampm = "none"))
        assertEquals("알람 두 개를 전부 삭제할까요?", t.say)
        val y = say(t.state, "응", yes)
        assertEquals("알람 두 개를 전부 삭제했어요", y.say)
        assertEquals(0, y.state.alarms.size)
    }

    @Test fun deleteAllWithConditionNamesOnlyThose() {
        val s = say(twoAlarms(), "오후 아홉 시", "<maum_1>(command=set, date=none, ampm=pm, time=09:00, time_type=absolute, type=none, repeat=weekly, days=weekend, confirm=no)<maum_end>").state
        val t = say(s, "아침 알람 전부 지워", del(target = "all"))
        println("조건 있는 전체 삭제 질문: ${t.say}")
        assertEquals(true, t.say.endsWith("알람 두 개를 삭제할까요?"))
        val y = say(t.state, "응", yes)
        assertEquals("알람 두 개를 삭제했어요", y.say)
        assertEquals(1, y.state.alarms.size)
    }

    @Test fun deleteAllWithNoAlarmsDoesNotAsk() {
        val t = say(BedState(), "알람 전부 지워", del(target = "all", ampm = "none"))
        assertEquals("맞춰 둔 알람이 없어요", t.say)
        assertNull(t.state.pending)
    }

    @Test fun deleteAllWithNoMatchDoesNotAsk() {
        val t = say(twoAlarms(), "오후 알람 전부 지워", del(target = "all", ampm = "pm"))
        assertEquals("말씀하신 알람이 없어요", t.say)
        assertNull(t.state.pending)
    }

    // 묻는 사이 대상 알람이 바뀌면 지우지 않는다
    @Test fun deleteStopsWhenTargetChanged() {
        val t = say(twoAlarms(), "일곱 시 알람 지워", del())
        val changed = t.state.copy(alarms = t.state.alarms.map { it.copy(time = it.time.plusMinutes(10)) })
        val y = say(changed, "응", yes)
        assertEquals(changed.alarms, y.state.alarms)
        assertEquals("그사이 알람이 바뀌어서 삭제하지 않았어요. 다시 말씀해 주세요", y.say)
        assertNull(y.state.pending)
    }

    // 묻는 사이 다른 알람이 늘어도 물어본 알람만 지운다
    @Test fun deleteAllKeepsAlarmAddedWhileAsking() {
        val s = twoAlarms()
        val t = say(s, "알람 전부 지워", del(target = "all", ampm = "none"))
        val added = t.state.copy(alarms = t.state.alarms + s.alarms.first().copy(id = 99))
        val y = say(added, "응", yes)
        assertEquals(listOf(99), y.state.alarms.map { it.id })
    }

    // ---------- 저장·되돌리기 확인 ----------
    private fun save(p: String, confirm: String = "no") = "<maum_0>(command=set_default, purpose=$p, confirm=$confirm)<maum_end>"
    private fun at(head: Double, leg: Double, memory: Map<com.jaljayo.board.brain.Purpose, Angles> = emptyMap(), purpose: com.jaljayo.board.brain.Purpose? = null) =
        BedState(angles = Angles(head, leg), target = Angles(head, leg), memory = memory, purpose = purpose)
    private val READ = com.jaljayo.board.brain.Purpose.READ
    private val TV = com.jaljayo.board.brain.Purpose.TV

    @Test fun saveOverSavedValueAsksThenYesSaves() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "이 자세로 독서 저장해", save("read"))
        assertEquals("지금 자세를 독서 기본 자세로 저장할까요?", t.say)
        assertEquals(s.memory, t.state.memory)
        val y = say(t.state, "응", yes)
        assertEquals("지금 자세를 독서 기본 자세로 저장했어요", y.say)
        assertEquals(Angles(20.0, 5.0), y.state.memory[READ])
        assertNull(y.state.pending)
    }

    // 저장 기록이 없어도 처음 값이 바뀌면 묻는다
    @Test fun saveOverFactoryValueAsks() {
        val s = at(20.0, 5.0)
        val t = say(s, "수면 자세로 바꾸는 일정 잡아 줘", save("sleep"))
        assertEquals("save", t.state.pending?.kind)
        assertEquals(s.memory, t.state.memory)
    }

    @Test fun saveNoKeepsValue() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)))
        val n = say(say(s, "저장해", save("read")).state, "아니", no)
        assertEquals(s.memory, n.state.memory)
        assertNull(n.state.pending)
    }

    // 각도가 그대로면 묻지 않고 바꾸는 것도 없다(저장값·처음 값 둘 다)
    @Test fun saveSameValueDoesNotAsk() {
        val saved = at(20.0, 5.0, mapOf(READ to Angles(20.0, 5.0)))
        val a = say(saved, "저장해", save("read"))
        assertEquals("지금 자세가 이미 독서 기본 자세예요", a.say)
        assertNull(a.state.pending)
        assertEquals(saved, a.state)
        val factory = at(30.0, 10.0)
        val b = say(factory, "저장해", save("tv"))
        assertNull(b.state.pending)
        assertEquals(factory, b.state)
    }

    @Test fun saveWithConfirmAsksOnlyOnce() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "이거 독서 자세로 하고 싶긴 하네", save("read", "yes"))
        assertEquals("save", t.state.pending?.kind)
        val y = say(t.state, "응", yes)
        assertEquals(Angles(20.0, 5.0), y.state.memory[READ])
        assertNull(y.state.pending)
    }

    // 지금 목적으로 저장해도 물어본 그 목적에 저장한다
    @Test fun saveWithoutPurposeUsesCurrentPurposeAsked() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)), READ)
        val t = say(s, "이게 기본이야", save("none"))
        assertEquals("지금 자세를 독서 기본 자세로 저장할까요?", t.say)
        val y = say(t.state.copy(purpose = TV), "응", yes)
        assertEquals(Angles(20.0, 5.0), y.state.memory[READ])
        assertNull(y.state.memory[TV])
    }

    // 묻는 사이 자세가 바뀌면 저장하지 않는다
    @Test fun saveStopsWhenPostureChanged() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "저장해", save("read"))
        val moved = t.state.copy(angles = Angles(25.0, 5.0), target = Angles(25.0, 5.0))
        val y = say(moved, "응", yes)
        assertEquals("그사이 자세가 바뀌어서 저장하지 않았어요. 다시 말씀해 주세요", y.say)
        assertEquals(s.memory, y.state.memory)
        assertNull(y.state.pending)
    }

    @Test fun saveStopsWhileMoving() {
        val s = at(20.0, 5.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "저장해", save("read"))
        val y = say(t.state.copy(target = Angles(40.0, 5.0)), "응", yes)
        assertEquals("멈춘 뒤에 말씀해 주세요", y.say)
        assertEquals(s.memory, y.state.memory)
    }

    // 저장값 초기화는 직접 요청해도 한 번 묻고, "응"을 들으면 물어본 범위만 되돌린다(11/02 결정)
    @Test fun resetDirectAsksOnceThenYesResets() {
        val s = at(0.0, 0.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "저장한 거 다 지워", "<maum_0>(command=reset_default, purpose=all, confirm=no)<maum_end>")
        assertEquals("모든 자세의 저장 각도를 처음 값으로 되돌릴까요?", t.say)
        assertEquals(s.memory, t.state.memory)
        val y = say(t.state, "응", yes)
        assertEquals("모든 자세의 저장 각도를 처음 값으로 되돌렸어요", y.say)
        assertEquals(0, y.state.memory.size)
        assertNull(y.state.pending)
    }

    // 저장값이 처음 값과 같아도 묻는다
    @Test fun resetAsksEvenWhenNothingSaved() {
        val t = say(at(0.0, 0.0), "독서 자세 처음 값으로", "<maum_0>(command=reset_default, purpose=read, confirm=no)<maum_end>")
        assertEquals("독서 자세의 저장 각도를 처음 값으로 되돌릴까요?", t.say)
        val n = say(t.state, "아니", no)
        assertNull(n.state.pending)
    }

    // 제안으로 나온 되돌리기는 먼저 묻는다
    @Test fun resetOneWithConfirmAsksOnlyOnce() {
        val s = at(0.0, 0.0, mapOf(READ to Angles(50.0, 10.0), TV to Angles(35.0, 10.0)))
        val t = say(s, "독서 자세 처음으로 돌리고 싶어", "<maum_0>(command=reset_default, purpose=read, confirm=yes)<maum_end>")
        assertEquals("독서 자세의 저장 각도를 처음 값으로 되돌릴까요?", t.say)
        val y = say(t.state, "응", yes)
        assertEquals(mapOf(TV to Angles(35.0, 10.0)), y.state.memory)
        assertNull(y.state.pending)
    }

    // 처리 중 오류가 나도 상태를 바꾸지 않고 다시 말해 달라고 한다
    @Test fun handleSafelyKeepsStateOnError() {
        val c = com.jaljayo.board.brain.Command("maum_1", "set", mapOf("command" to "set", "date" to "none", "ampm" to "none", "time" to "days_3", "time_type" to "relative", "type" to "none", "repeat" to "none", "days" to "none", "confirm" to "no"))
        val s = BedState()
        val t = brain.handleSafely(s, "시험", c, "시험")
        assertEquals("다시 한 번 말씀해 주세요", t.say)
        assertEquals(s, t.state)
    }

    // ---------- 다시 묻기(11/02 결정) ----------
    private val setNoTime = "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>"
    private fun asked(t: Turn) = t.state.copy(lastSpeech = t.say)

    @Test fun wrongReplyToTimeQuestionTellsWhatToSay() {
        val t = say(BedState(), "알람 맞춰 줘", setNoTime)
        val a = say(asked(t), "머리", "<maum_2>(type=part, value=head)<maum_end>")
        assertEquals("시각을 말씀해 주세요. 몇 시에 맞출까요?", a.say)
        assertEquals(t.state.pending, a.state.pending)
        val d = say(asked(t), "사흘", "<maum_2>(type=duration, value=days_3)<maum_end>")
        assertEquals("시각을 말씀해 주세요. 몇 시에 맞출까요?", d.say)
        val y = say(asked(t), "응", yes)
        assertEquals("시각을 말씀해 주세요. 몇 시에 맞출까요?", y.say)
        // 두 번 틀려도 앞말이 겹치지 않는다
        val again = say(asked(d), "머리", "<maum_2>(type=part, value=head)<maum_end>")
        assertEquals("시각을 말씀해 주세요. 몇 시에 맞출까요?", again.say)
    }

    @Test fun wrongReplyToPartQuestionTellsWhatToSay() {
        val t = say(BedState(), "좀 올려", "<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>")
        val a = say(asked(t), "삼십", "<maum_2>(type=number, value=30)<maum_end>")
        assertEquals("머리나 다리를 말씀해 주세요. 어느 쪽을 맞출까요?", a.say)
    }

    @Test fun wrongReplyToYesNoQuestionTellsWhatToSay() {
        val t = say(BedState(), "머리가 좀 낮네", "<maum_0>(command=adjust, part=head, direction=up, amount=small, amount_type=delta, confirm=yes)<maum_end>")
        val a = say(asked(t), "일곱 시", "<maum_2>(type=time, value=07:00)<maum_end>")
        assertEquals("네 또는 아니요로 말씀해 주세요. ${t.say}", a.say)
        assertEquals(t.state.target, a.state.target)
    }

    @Test fun errorWhileAskingTellsWhatToSay() {
        val t = say(BedState(), "알람 맞춰 줘", setNoTime)
        val c = com.jaljayo.board.brain.Command("maum_1", "set", mapOf("command" to "set", "date" to "none", "ampm" to "none", "time" to "days_3", "time_type" to "relative", "type" to "none", "repeat" to "none", "days" to "none", "confirm" to "no"))
        val e = brain.handleSafely(asked(t), "시험", c, "시험")
        assertEquals("시각을 말씀해 주세요. 몇 시에 맞출까요?", e.say)
        assertEquals(t.state.alarms, e.state.alarms)
    }

    // 물은 것이 없는 동의는 무엇을 할지 묻고, 움직이는 중이면 그대로 둔다(11/03 결정)
    @Test fun yesWithNothingAskedAsksWhatToDo() {
        assertEquals("무엇을 할까요? '머리 올려'나 '알람 꺼'처럼 말씀해 주세요", say(BedState(), "알아서 해", yes).say)
        val moving = BedState(angles = Angles(0.0, 0.0), target = Angles(30.0, 0.0))
        assertEquals("", say(moving, "알아서 해", yes).say)
    }

    // ---------- 날짜 전체 건너뛰기 ----------
    private val skipTomorrowAll = "<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow, confirm=yes, target_type=none, target_order=none)<maum_end>"
    private fun amPm(): BedState {
        val a = say(BedState(), "매일 일곱 시", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state
        return say(a, "매일 밤 아홉 시", "<maum_1>(command=set, date=none, ampm=pm, time=09:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
    }

    @Test fun skipAllAsksWithSkipWords() {
        val t = say(amPm(), "내일 쉬니까 너도 쉬어", skipTomorrowAll)
        assertEquals("내일 알람을 전부 건너뛸까요?", t.say)
        val y = say(t.state, "응", yes)
        assertEquals("내일 알람을 전부 건너뛰었어요", y.say)
        assertEquals(2, y.state.alarms.count { it.skips.isNotEmpty() })
    }

    // 전부 건너뛰기를 묻는 중 "오전만": 날짜는 그대로, 대상만 오전으로 좁혀 다시 묻는다. 바로 실행하지 않는다
    @Test fun morningOnlyNarrowsSkipAllAndAsksAgain() {
        val s = amPm()
        val t = say(s, "내일 쉬니까 너도 쉬어", skipTomorrowAll)
        val a = say(t.state, "오전만", "<maum_2>(type=ampm, value=am)<maum_end>")
        assertEquals("내일 오전 알람을 건너뛸까요?", a.say)
        assertEquals(s.alarms, a.state.alarms)
        val y = say(a.state, "응", yes)
        assertEquals("내일 오전 알람을 건너뛰었어요", y.say)
        assertEquals(listOf(true, false), y.state.alarms.map { it.skips.isNotEmpty() })
    }

    @Test fun morningOnlyCommandNarrowsSkipAllAndAsksAgain() {
        val s = amPm()
        val t = say(s, "내일 쉬니까 너도 쉬어", skipTomorrowAll)
        for ((heard, out) in listOf(
            "오전만 꺼 줘" to "<maum_1>(command=off, target=none, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>",
            "오전만 건너뛰어 줘" to "<maum_1>(command=skip, target=none, target_ampm=am, target_days=none, date=none, confirm=no, target_type=none, target_order=none)<maum_end>")) {
            val a = say(t.state, heard, out)
            assertEquals(heard, "내일 오전 알람을 건너뛸까요?", a.say)
            assertEquals(heard, s.alarms, a.state.alarms)
        }
    }

    // 묻는 중이 아니면 "오전만 꺼 줘"는 그대로 오전 알람 끄기다
    @Test fun morningOffWithoutSkipQuestionIsOff() {
        val a = say(amPm(), "오전 알람 꺼 줘", "<maum_1>(command=off, target=none, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(listOf(false, true), a.state.alarms.map { it.enabled })
    }

    // ---------- 쓰지 않는 한자어 시각(11/03 결정) ----------
    @Test fun badHourWordsAreDetected() {
        // 기대 정답 표는 자료 쪽 rules_1103_expected.py와 같다
        val bad = mapOf("구 시" to listOf("구"), "팔 시에" to listOf("팔"), "육시" to listOf("육"), "공이 시" to listOf("공이"), "스무 시" to listOf("스무"), "스물두 시요" to listOf("스물두"),
            "스물다섯 시" to listOf("스물다섯"), "서른두 시" to listOf("서른두"), "이십오 시" to listOf("이십오"), "팔 시 정각" to listOf("팔"), "평일 스물세 시 알람" to listOf("스물세"),
            "구 시인데" to listOf("구"), "구 시하고" to listOf("구"), "구 시라서" to listOf("구"), "오후다섯 시" to listOf(), "아침칠 시" to listOf("칠"), "아홉 시야" to listOf(), "평일구 시" to listOf("구"), "주말팔 시 알람" to listOf("팔"),
            "내일은구 시" to listOf("구"), "평일에는공이 시" to listOf("공이"), "오전에는구 시" to listOf("구"), "매주칠 시" to listOf("칠"))
        for ((w, want) in bad) assertEquals(w, want, com.jaljayo.board.brain.Rules.badHours(w))
        for (w in listOf("아홉 시", "열한 시", "열두 시", "십 시", "십일 시", "이십일 시", "공구 시", "공두 시", "영 시", "공공 시", "이십사 시", "일시정지", "일시 정지", "이 시간", "이 시점",
            "이 시설", "이 시리즈", "한 시", "몇 시야", "스물다섯 시간", "세 시간 뒤", "이 시작", "오 시각", "열 시도 괜찮아", "삼시세끼", "삼시 세끼", "이 시국에",
            "삼시세끼 챙겨 먹으려고 아침 일곱 시 알람 맞춰 줘", "평일아홉 시")) assertEquals(w, false, brain.badHour(w))
    }

    @Test fun badHourInSetAsksExactTime() {
        val t = say(BedState(), "내일 하루만 육 시에 깨워", "<maum_1>(command=set, date=tomorrow, ampm=none, time=none, time_type=none, type=none, repeat=once, days=none, confirm=no)<maum_end>")
        assertEquals("정확한 시각을 다시 말씀해 주세요. 내일 알람을 몇 시에 맞출까요?", t.say)
    }

    // 대상 시각을 못 받았으면 하나뿐인 알람이나 직전 알람을 대신 고르지 않는다
    @Test fun badHourTargetDoesNotPickOnlyAlarm() {
        val one = say(BedState(), "평일 일곱 시", weekday).state
        val u = say(one, "구 시 알람 삭제해", del("none", "none"))
        assertEquals("정확한 시각을 다시 말씀해 주세요. 어떤 알람을 삭제할까요?", u.say)
        assertEquals("alarm", u.state.pending?.kind)
        assertEquals(one.alarms, u.state.alarms)
    }

    @Test fun badHourReplyAsksExactTimeAgain() {
        val t = say(BedState(), "알람 맞춰 줘", setNoTime)
        val a = say(asked(t), "구 시", "<maum_2>(type=unclear, value=none)<maum_end>")
        assertEquals("정확한 시각을 다시 말씀해 주세요. 몇 시에 맞출까요?", a.say)
        assertEquals(t.state.pending, a.state.pending)
    }

    // 받아쓰기가 숫자로 낸 시각은 쓰는 시각 목록 안의 말로 바뀌어 다시 묻지 않는다(11/03)
    @Test fun digitHoursBecomeAllowedWords() {
        val h = com.jaljayo.board.brain.Hearing
        for ((raw, want) in listOf("9시" to "아홉 시", "09시" to "아홉 시", "12시" to "열두 시", "21시" to "이십일 시", "0시" to "영 시", "24시" to "이십사 시", "7:30" to "일곱 시 반", "13:05" to "십삼 시 오 분")) {
            val t = h.normalize(raw)
            assertEquals(raw, want, t)
            assertEquals(raw, false, brain.badHour(t))
        }
    }

    // 영문으로 받아쓴 TV 등이 지워져 자세 이름이 사라지지 않는다. 모델에 실제로 들어가는 글자를 본다(11/03)
    @Test fun latinWordsKeepMeaning() {
        val h = com.jaljayo.board.brain.Hearing
        for ((raw, want) in listOf(
            "저장된 TV 자세를 불러와 주세요." to "저장된 티비 자세를 불러와 주세요",
            "TV자세로 바꿔 줘" to "티비 자세로 바꿔 줘",
            "tv 자세 예약 취소해" to "티비 자세 예약 취소해",
            "T.V 자세" to "티비 자세",
            "OK 그걸로 해" to "오케이 그걸로 해",
            "와이파이 말고 wifi 다시 연결해 줘" to "와이파이 말고 와이파이 다시 연결해 줘",
            "Bluetooth 켜 줘" to "블루투스 켜 줘",
            "ATV 자세" to "자세",          // 다른 영단어 속 TV는 바꾸지 않음
            "<|ko|>알람 꺼 줘." to "알람 꺼 줘")) {
            assertEquals(raw, want, h.normalize(raw))
        }
    }

    // 받아쓰기가 숫자로 낸 순번·횟수·단위가 학습 문장과 같은 말이 된다(11/03: "2번째"가 "이번째"로 바뀌던 문제)
    @Test fun digitCountersMatchTrainingWords() {
        val h = com.jaljayo.board.brain.Hearing
        for ((raw, want) in listOf(
            "2번째 알람" to "두 번째 알람", "1번째요" to "첫 번째요", "11번째" to "열한 번째",
            "1번만 해 줘" to "한 번만 해 줘", "이번만 3번 울려" to "이번만 세 번 울려",
            "알람 2개 다 꺼" to "알람 두 개 다 꺼",
            "30분 뒤에" to "삼십 분 뒤에", "5분만 더" to "오 분만 더", "머리 10도 올려" to "머리 십 도 올려",
            "3일 동안 꺼 줘" to "삼 일 동안 꺼 줘", "2주만" to "이 주만",
            "1시간 반 뒤" to "한 시간 반 뒤", "24시간 뒤" to "이십사 시간 뒤", "7:30" to "일곱 시 반",
            "답은 1,000" to "답은 천", "답은 562" to "답은 오백육십이", "999요" to "구백구십구요")) {
            assertEquals(raw, want, h.normalize(raw))
        }
    }

    // ---------- 코덱스 재현 시험(11/03) ----------
    private val oneAlarm get() = say(BedState(), "평일 일곱 시", weekday).state

    // 시각을 다시 받아도 바람(confirm=yes)이면 실행 전에 동의를 묻는다
    @Test fun wishAskedForTimeStillAsksConsent() {
        val t = say(oneAlarm, "구 시 알람 꺼 두고 싶어", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=yes)<maum_end>")
        assertEquals("정확한 시각을 다시 말씀해 주세요. 어떤 알람을 끌까요?", t.say)
        val a = say(asked(t), "오전 일곱 시", "<maum_2>(type=time, value=am_07:00)<maum_end>")
        assertEquals(true, a.state.alarms.all { it.enabled })
        assertEquals("confirm", a.state.pending?.kind)
        val y = say(a.state, "응", yes)
        assertEquals(true, y.state.alarms.none { it.enabled })
    }

    @Test fun wishAskedForClockStillAsksConsent() {
        val t = say(BedState(), "알람 하나 있었으면 좋겠어", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=yes)<maum_end>")
        val a = say(asked(t), "오전 일곱 시", "<maum_2>(type=time, value=am_07:00)<maum_end>")
        assertEquals(0, a.state.alarms.size)
        assertEquals("confirm", a.state.pending?.kind)
    }

    // 묻는 건너뛰기가 "전부(target=all)"여도 "오전만 꺼 줘"로 좁힌다
    @Test fun morningOnlyNarrowsSkipAllTargetAll() {
        val s = amPm()
        val t = say(s, "내일 쉬니까 너도 쉬어", "<maum_1>(command=skip, target=all, target_ampm=none, target_days=none, date=tomorrow, confirm=yes, target_type=none, target_order=none)<maum_end>")
        assertEquals("내일 알람을 전부 건너뛸까요?", t.say)
        val a = say(t.state, "오전만 꺼 줘", "<maum_1>(command=off, target=none, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("내일 오전 알람을 건너뛸까요?", a.say)
        assertEquals(true, a.state.alarms.all { it.enabled })
    }

    // 초기화할 자세를 물은 뒤 자세 이름 대답은 초기화로 이어진다(자세 이동이 아님)
    @Test fun resetPurposeAnswerContinuesReset() {
        val s = at(0.0, 0.0, mapOf(READ to Angles(50.0, 10.0)))
        val t = say(s, "저장값 초기화해", "<maum_0>(command=reset_default, purpose=none, confirm=no)<maum_end>")
        assertEquals("어떤 자세를 기본 각도로 되돌릴까요?", t.say)
        val a = say(t.state, "독서", "<maum_2>(type=purpose, value=read)<maum_end>")
        assertEquals("독서 자세의 저장 각도를 처음 값으로 되돌릴까요?", a.say)
        assertEquals(s.target, a.state.target)
    }

    // 묻는 사이 다른 안내를 해도 다시 물을 때는 묻던 질문을 쓴다
    @Test fun reaskUsesAskedQuestionNotLastSpeech() {
        val t = say(BedState(), "머리가 좀 낮네", "<maum_0>(command=adjust, part=head, direction=up, amount=small, amount_type=delta, confirm=yes)<maum_end>")
        val q = say(asked(t), "지금 몇 시야", "<maum_4>(command=tell_time)<maum_end>")
        val a = say(asked(q), "일곱 시", "<maum_2>(type=time, value=07:00)<maum_end>")
        assertEquals("네 또는 아니요로 말씀해 주세요. ${t.say}", a.say)
    }

    // 24시간제로 분명한 시각은 다른 시간대 알람을 고르지 않는다
    @Test fun twentyFourHourTargetsDoNotCrossAmPm() {
        val pm1 = say(BedState(), "오후 한 시", "<maum_1>(command=set, date=none, ampm=pm, time=01:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state
        val a = say(pm1, "공일 시 알람 꺼 줘", "<maum_1>(command=off, target=01:00, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(true, a.state.alarms.all { it.enabled })
        val two = say(pm1, "오전 한 시", "<maum_1>(command=set, date=none, ampm=am, time=01:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>").state
        val b = say(two, "십삼 시 알람 꺼 줘", "<maum_1>(command=off, target=13:00, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(listOf(13), b.state.alarms.filter { !it.enabled }.map { it.time.hour })
        val c = say(two, "영 시 알람 꺼 줘", "<maum_1>(command=off, target=00:00, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("말씀하신 알람이 없어요", c.say)
    }

    // 오늘 이십사 시는 오늘이 끝나는 때 = 다음 날 0시
    @Test fun todayTwentyFourIsNextMidnight() {
        val t = say(BedState(), "오늘 이십사 시에 깨워 줘", "<maum_1>(command=set, date=today, ampm=none, time=24:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        val a = t.state.alarms.single()
        val today = com.jaljayo.board.brain.AlarmFinder.nowLocal(1_800_000_000_000L).toLocalDate()
        assertEquals(0, a.time.hour)
        assertEquals(today.plusDays(1), a.onceDate)
    }

    // 자세 질문 뒤 대답이 그 명령으로 이어진다(질문만 하고 대기를 남기지 않던 자리)
    @Test fun savePurposeAnswerContinuesSave() {
        val s = at(30.0, 10.0)
        val t = say(s, "지금 각도 저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        assertEquals("purpose", t.state.pending?.kind)
        val a = say(t.state, "독서", "<maum_2>(type=purpose, value=read)<maum_end>")
        assertEquals("지금 자세를 독서 기본 자세로 저장할까요?", a.say)
        val y = say(a.state, "응", yes)
        assertEquals(Angles(30.0, 10.0), y.state.memory[READ])
        assertEquals(s.target, y.state.target)
    }

    @Test fun reserveTimeAnswerContinuesReserve() {
        val t = say(BedState(), "독서 자세 예약해", "<maum_0>(command=reserve, purpose=read, date=none, ampm=none, time=none, time_type=none, confirm=no)<maum_end>")
        assertEquals("몇 시에 바꿀까요?", t.say)
        val a = say(asked(t), "삼십 분 뒤", "<maum_2>(type=relative_time, value=00:30)<maum_end>")
        assertNotNull(a.state.reservation)
    }

    @Test fun callPurposeAnswerContinuesCall() {
        val t = say(BedState(), "자세 바꿔 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        val a = say(t.state, "티비", "<maum_2>(type=purpose, value=tv)<maum_end>")
        assertEquals(Angles(30.0, 10.0), a.state.target)
    }

    // 바람으로 시작한 자세 질문은 자세를 받은 뒤에도 실행 전에 묻는다
    @Test fun purposeWishStillAsksConsent() {
        val t = say(BedState(), "자세를 바꾸고 싶어", "<maum_0>(command=call, purpose=none, confirm=yes)<maum_end>")
        assertEquals("어떤 자세로 바꿀까요?", t.say)
        val a = say(t.state, "독서", "<maum_2>(type=purpose, value=read)<maum_end>")
        assertEquals(Angles(0.0, 0.0), a.state.target)
        assertEquals("confirm", a.state.pending?.kind)
        val r = say(BedState(), "삼십 분 뒤 자세 예약하고 싶어", "<maum_0>(command=reserve, purpose=none, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>")
        val b = say(r.state, "독서", "<maum_2>(type=purpose, value=read)<maum_end>")
        assertNull(b.state.reservation)
        assertEquals("confirm", b.state.pending?.kind)
    }

    // 알람 종류·난이도를 물은 뒤 종류·난이도만 말한 명령은 묻던 알람에 이어진다
    @Test fun alarmTypeAndLevelAnswersContinue() {
        val one = say(BedState(), "평일 일곱 시", weekday).state
        val t = say(one, "일곱 시 알람 종류 바꿔", "<maum_1>(command=change_type, target=07:00, target_ampm=none, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("alarm_type", t.state.pending?.kind)
        val a = say(t.state, "침대 이탈 알람으로", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=leave_bed, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("leave_bed", a.state.alarms.single().type)
        val q = say(BedState(), "덧셈 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=question, repeat=weekly, days=weekdays, confirm=no)<maum_end>").state
        val l = say(q, "덧셈 알람 난이도 바꿔", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=none, date=none, scope=none, target_type=question, target_order=none, context=alarm, confirm=no)<maum_end>")
        assertEquals("level", l.state.pending?.kind)
        val m = say(l.state, "두 자리", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=two, date=none, scope=none, target_type=none, target_order=none, context=required, confirm=no)<maum_end>")
        assertEquals(2, m.state.alarms.single().level)
    }

    // 난이도·종류를 묻는 중 다른 알람을 가리키면 새 요청으로 처리하고, 바람이면 실행 전에 묻는다(코덱스 재현)
    private val lv = { level: String, target: String, confirm: String -> "<maum_1>(command=change_level, target=$target, target_ampm=none, target_days=none, level=$level, date=none, scope=none, target_type=question, target_order=none, context=alarm, confirm=$confirm)<maum_end>" }
    private fun twoQuestionAlarms(): BedState {
        val a = say(BedState(), "일곱 시 덧셈", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=question, repeat=weekly, days=daily, confirm=no)<maum_end>").state
        return say(a, "여덟 시 덧셈", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=question, repeat=weekly, days=daily, confirm=no)<maum_end>").state.copy(lastAlarmId = null)
    }

    @Test fun levelWaitWithNewTargetIsNewRequest() {
        val t = say(twoQuestionAlarms(), "일곱 시 덧셈 알람 난이도 바꿔", lv("none", "07:00", "no"))
        assertEquals("level", t.state.pending?.kind)
        val a = say(t.state, "여덟 시 덧셈 알람 두 자리로 바꿔", lv("two", "08:00", "no"))
        assertEquals(mapOf(7 to 1, 8 to 2), a.state.alarms.associate { it.time.hour to it.level })
    }

    @Test fun levelWaitWishAnswerStillAsks() {
        val t = say(twoQuestionAlarms(), "일곱 시 덧셈 알람 난이도 바꿔", lv("none", "07:00", "no"))
        val a = say(t.state, "두 자리면 좋겠어", "<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=two, date=none, scope=none, target_type=none, target_order=none, context=required, confirm=yes)<maum_end>")
        assertEquals(true, a.state.alarms.all { it.level == 1 })
        assertEquals("confirm", a.state.pending?.kind)
        val y = say(a.state, "응", yes)
        assertEquals(mapOf(7 to 2, 8 to 1), y.state.alarms.associate { it.time.hour to it.level })
    }

    @Test fun typeWaitWithOtherKindIsNewRequest() {
        val one = say(BedState(), "평일 일곱 시", weekday).state
        val t = say(one, "일곱 시 알람 종류 바꿔", "<maum_1>(command=change_type, target=07:00, target_ampm=none, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        val a = say(t.state, "내일 알람을 침대 이탈 알람으로", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=tomorrow, type=leave_bed, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals(null, a.state.pending?.takeIf { it.kind == "alarm_type" })
        val w = say(t.state, "침대 이탈 알람이면 좋겠어", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=leave_bed, scope=none, target_type=none, target_order=none, confirm=yes)<maum_end>")
        assertEquals("basic", w.state.alarms.single().type)
        assertEquals("confirm", w.state.pending?.kind)
    }
}
