package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Hearing
import com.jaljayo.board.brain.Part
import com.jaljayo.board.brain.Purpose
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

// 14차(11/10) 결정: 양 5·10·20도, 계속 끝까지, 잠깐만, 숫자 두 개(set_angles), 자세 각도 묻기, 알람 종류 묻기,
// 목록 뒤 순서 대답, 덧셈 중 끄기, 숫자·시각 대답 보정, 안내 문구, 받아쓰기 숫자, 부르는 말
class Round14Test {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { 1_800_000_000_000L }
    private val every = DayOfWeek.entries.toSet()

    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out)
        assertTrue("$out -> $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun adj(part: String, dir: String, amount: String, type: String = if (amount == "none") "none" else "delta") =
        "<maum_0>(command=adjust, part=$part, direction=$dir, amount=$amount, amount_type=$type, confirm=no)<maum_end>"
    private val at = BedState(angles = Angles(30.0, 20.0), target = Angles(30.0, 20.0))

    @Test fun amountSmallNoneLarge() {
        assertEquals(25.0, say(at, "머리 좀 내려", adj("head", "down", "small")).state.target.head, 0.0)
        assertEquals(20.0, say(at, "머리 내려", adj("head", "down", "none")).state.target.head, 0.0)   // 전에는 끝까지(0도)
        assertEquals(10.0, say(at, "머리 많이 내려", adj("head", "down", "large")).state.target.head, 0.0)
        assertEquals(20.0, say(BedState(), "다리 많이 올려", adj("leg", "up", "large")).state.target.leg, 0.0)
        assertEquals(Angles(20.0, 10.0), say(at, "다 내려", adj("both", "down", "none")).state.target)
        assertEquals(Angles(50.0, 40.0), say(at, "다 많이 올려", adj("both", "up", "large")).state.target)   // 다리는 최대 40도
        assertEquals("머리를 20도 내릴까요?", say(at, "머리 많이 내렸으면", adj("head", "down", "large").replace("confirm=no", "confirm=yes")).say)
    }

    @Test fun keepGoingToTheEndFollowsLastDirection() {
        val down = at.copy(lastPart = Part.HEAD, lastDir = "down")
        val t = say(down, "머리 계속 끝까지", "<maum_0>(command=adjust, part=head, direction=same, amount=max, amount_type=target, confirm=no)<maum_end>")
        assertEquals(0.0, t.state.target.head, 0.0)
        val up = at.copy(lastPart = Part.HEAD, lastDir = "up")
        assertEquals(60.0, say(up, "머리 계속 끝까지", "<maum_0>(command=adjust, part=head, direction=same, amount=max, amount_type=target, confirm=no)<maum_end>").state.target.head, 0.0)
    }

    @Test fun waitStopsWhileMoving() {
        val moving = BedState(angles = Angles(10.0, 0.0), target = Angles(40.0, 0.0), moveStart = Angles(0.0, 0.0))
        val t = brain.quickStop(moving, "잠깐만")!!
        assertEquals(t.state.angles, t.state.target)
        assertNull(brain.quickStop(BedState(), "잠깐만"))   // 움직이지 않을 때는 모델로 보낸다
    }

    @Test fun setAnglesMovesOrChangesPreset() {
        val t = say(BedState(), "삼십 이십 해 줘", "<maum_0>(command=set_angles, purpose=none, head=30, leg=20, confirm=no)<maum_end>")
        assertEquals(Angles(30.0, 20.0), t.state.target)
        assertEquals("머리 30도, 다리 20도로 맞췄어요", t.state.after)
        val over = say(BedState(), "육십 칠십 해 줘", "<maum_0>(command=set_angles, purpose=none, head=60, leg=70, confirm=no)<maum_end>")
        assertEquals(Angles(60.0, 40.0), over.state.target)
        assertEquals("머리 60도, 다리는 최대인 40도로 맞췄어요", over.state.after)
        val ask = say(BedState(), "삼십 이십", "<maum_0>(command=set_angles, purpose=none, head=30, leg=20, confirm=yes)<maum_end>")
        assertEquals("머리 30도, 다리 20도로 맞출까요?", ask.say)
        assertEquals(Angles(0.0, 0.0), ask.state.target)
        val preset = say(at, "독서 이십 삼십 해 줘", "<maum_0>(command=set_angles, purpose=read, head=20, leg=30, confirm=no)<maum_end>")
        assertEquals(at.target, preset.state.target)   // 침대는 안 움직임
        assertEquals(Angles(20.0, 30.0), preset.state.memory[Purpose.READ])
        assertEquals("독서 자세를 머리 20도, 다리 30도로 맞췄어요", preset.say)
        val presetAsk = say(at, "독서 이십 삼십", "<maum_0>(command=set_angles, purpose=read, head=20, leg=30, confirm=yes)<maum_end>")
        assertEquals("독서 자세를 머리 20도, 다리 30도로 맞출까요?", presetAsk.say)
        assertNull(presetAsk.state.memory[Purpose.READ])
    }

    @Test fun tellAnglesOfPreset() {
        assertEquals("독서 자세는 머리 45도, 다리 15도예요", say(at, "독서 각도 몇 도야", "<maum_4>(command=tell_angles, part=none, purpose=read)<maum_end>").say)
        val saved = at.copy(memory = mapOf(Purpose.SLEEP to Angles(5.0, 10.0)))
        assertEquals("잠 자세는 머리 5도, 다리 10도예요", say(saved, "자는 각도 몇이야", "<maum_4>(command=tell_angles, part=none, purpose=sleep)<maum_end>").say)
        assertEquals("지금 머리는 30도, 다리는 20도예요", say(at.copy(angles = at.target), "지금 각도", "<maum_4>(command=tell_angles, part=none, purpose=none)<maum_end>").say)
        assertEquals("독서 자세 다리는 15도예요", say(at, "독서 자세 다리는 몇 도야", "<maum_4>(command=tell_angles, part=leg, purpose=read)<maum_end>").say)
        // 13차가 낸 옛 꼴(part=read)도 자세 각도로 받는다
        assertEquals("독서 자세는 머리 45도, 다리 15도예요", say(at, "독서 각도 몇 도야", "<maum_4>(command=tell_angles, part=read)<maum_end>").say)
    }

    @Test fun tellAlarmsByType() {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every), AlarmItem(2, LocalTime.of(6, 30), every, type = "question")))
        val t = say(s, "덧셈 알람 몇 시였지", "<maum_4>(command=tell_alarms, date=none, days=none, target_type=question)<maum_end>")
        assertTrue(t.say, "여섯 시 반" in t.say && "일곱 시" !in t.say)
        assertEquals("침대에서 나와야 꺼지는 알람은 없어요", say(s, "일어나야 꺼지는 알람", "<maum_4>(command=tell_alarms, date=none, days=none, target_type=leave_bed)<maum_end>").say)
        // 13차 옛 꼴(칸 두 개)도 받는다
        assertTrue(say(s, "알람 뭐 있어", "<maum_4>(command=tell_alarms, date=none, days=none)<maum_end>").say.contains("일곱 시"))
    }

    @Test fun orderAfterListedAlarms() {
        val s = BedState(alarms = listOf(AlarmItem(1, LocalTime.of(7, 0), every), AlarmItem(2, LocalTime.of(8, 0), every)))
        val off = "<maum_1>(command=off, target=none, target_ampm=am, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>"
        val q = say(s, "오전 알람 꺼", off)
        assertTrue(q.say, q.say.contains("어떤 알람을"))
        val t = say(q.state, "두 번째 거", "<maum_2>(type=order, value=index_2)<maum_end>")
        assertTrue(t.state.alarms.first { it.id == 1 }.enabled)
        assertFalse(t.state.alarms.first { it.id == 2 }.enabled)
        // 목록을 읽지 않았으면 지금처럼 시각을 묻는다
        assertEquals("몇 시 알람인지 정확한 시각으로 말씀해 주세요", say(s, "두 번째 거", "<maum_2>(type=order, value=index_2)<maum_end>").say)
    }

    @Test fun offDuringMathQuestionAsksToSolve() {
        val a = AlarmItem(1, LocalTime.of(7, 0), every, type = "question")
        val s = BedState(alarms = listOf(a), ringing = a, question = 3 to 5)
        val t = say(s, "그만 울려", "<maum_1>(command=off, target=none, target_ampm=none, target_days=none, date=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("문제를 풀어야 꺼져요. 삼 더하기 오는 얼마예요?", t.say)
        assertTrue(t.state.ringing != null)
    }

    @Test fun numberAndTimeAnswersReadHeard() {
        val a = AlarmItem(1, LocalTime.of(7, 0), every, type = "question")
        val s = BedState(alarms = listOf(a), ringing = a, question = 21 to 21)
        assertNull(say(s, "답은 마흔둘이야", "<maum_2>(type=number, value=52)<maum_end>").state.ringing)
        assertEquals("06:50", Brain.timeBefore("일곱 시 십 분 전이요"))
        assertEquals("pm_02:55", Brain.timeBefore("오후 세 시 오 분 전"))
        assertNull(Brain.timeBefore("아침 일곱 시 십 분 전"))
        assertNull(Brain.timeBefore("일곱 시에 깨워 줘"))
    }

    @Test fun guidanceTexts() {
        assertEquals(Rules.CHAT, say(BedState(), "주말엔 늦잠이 최고야", "<General_Conversation>()<maum_end>").say)
        assertEquals("필요하신 게 있으면 '머리 올려 줘', '알람 맞춰 줘'처럼 말씀해 주세요", Rules.CHAT)
        assertTrue(say(BedState(), "뭐 할 수 있어", "<maum_4>(command=tell_capabilities)<maum_end>").say.startsWith("저는 "))
    }

    @Test fun hearingNumbersAndWake() {
        assertTrue(Hearing.normalize("알람4흘 동안 꺼줘"), Hearing.normalize("알람4흘 동안 꺼줘").contains("알람 사흘"))
        assertTrue(Hearing.normalize("2틀 뒤에 깨워").startsWith("이틀"))
        assertTrue(Hearing.normalize("30도 20도 해줘").startsWith("삼십 도 이십 도"))
        assertTrue(Hearing.wake("잘자요보에").woke)
        assertTrue(Hearing.wake("잘 자요 머리 올려").woke)
        assertFalse(Hearing.wake("잘자는 법 알려 줘").woke)
    }

    @Test fun upgradeOldOutputs() {
        assertEquals("<maum_0>(command=adjust, part=head, direction=none, amount=30, amount_type=target, confirm=no)<maum_end>",
            Spec.upgrade("<maum_0>(command=adjust, part=head, direction=up, amount=30, amount_type=target, confirm=no)<maum_end>"))
        assertTrue(spec.parse("<maum_0>(command=adjust, part=head, direction=up, amount=30, amount_type=target, confirm=no)<maum_end>") is Spec.Result.Bad)
        assertTrue(spec.parse("<maum_0>(command=adjust, part=head, direction=up, amount=large, amount_type=target, confirm=no)<maum_end>") is Spec.Result.Bad)
        assertTrue(spec.parse("<maum_0>(command=set_angles, purpose=none, head=none, leg=20, confirm=no)<maum_end>") is Spec.Result.Bad)
    }
}
