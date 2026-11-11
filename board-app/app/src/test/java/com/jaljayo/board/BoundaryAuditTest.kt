package com.jaljayo.board

import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime
import java.time.LocalTime

// 11/04 학습 경계 점검에서 찾은 보드 처리 세 가지를 실제 동작으로 시험한다.
// 시계는 2026-11-04(수) 오전 6시
class BoundaryAuditTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private var nowMs = LocalDateTime.of(2026, 11, 4, 6, 0).atZone(KST).toInstant().toEpochMilli()
    private val brain = Brain { nowMs }
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"

    private fun say(s: BedState, heard: String, out0: String): Turn {
        val out = Spec.upgrade(out0)
        val r = spec.parse(out)
        assertTrue("규격 위반: $out $r", r is Spec.Result.Ok)
        return brain.handle(s, heard, (r as Spec.Result.Ok).cmd, out)
    }
    private fun one(): BedState {
        val t = say(BedState(), "오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>")
        assertEquals(1, t.state.alarms.size)
        return t.state.copy(lastAlarmId = null)
    }

    @Test fun ringingAlarmDelayedByChangeTimeLater() {
        // 울리는 중 "알람 끄진 말고 십오 분만 미뤄 줘"(change_time later, 대상 없음): 거절하지 않고 울리는 알람을 미룬다
        val s = one().let { it.copy(ringing = it.alarms.first()) }
        val t = say(s, "알람끄진 말고 십오 분만 미뤄 줘", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=00:15, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("십오 분 미뤘어요", t.say)
        assertNull(t.state.ringing)
        assertEquals(LocalTime.of(7, 0), t.state.alarms.first().time)  // 알람 설정 시각은 그대로
        // 대상을 말한 change_time은 지금처럼 울리는 중에는 받지 않는다
        val u = say(s, "일곱 시 알람 십오 분 늦춰", "<maum_1>(command=change_time, target=07:00, target_ampm=none, target_days=none, date=none, ampm=none, time=00:15, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertNotNull(u.state.ringing)
        // 먼저 묻기(confirm=yes)로 와도 울리는 중에는 묻지 않고 바로 미룬다(지금 울린 알람 미루기와 같은 기존 예외)
        val w = say(s, "알람 십 분만 늦췄으면 해", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=00:10, time_type=later, scope=none, target_type=none, target_order=none, confirm=yes)<maum_end>")
        assertEquals("십 분 미뤘어요", w.say); assertNull(w.state.pending)
        // 다른 회차(날짜)를 말하면 이번 회차 미루기가 아니라 받지 않는다
        val x = say(s, "내일 알람 십 분 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=tomorrow, ampm=none, time=00:10, time_type=later, scope=once, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertNotNull(x.state.ringing); assertEquals(LocalTime.of(7, 0), x.state.alarms.first().time)
        // 알람 시각 자체를 옮기는 말("앞으로 계속")은 이번 회차 미루기로 바꾸지 않는다
        val y = say(s, "알람 앞으로 계속 십 분 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=00:10, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertNotNull(y.state.ringing); assertEquals(LocalTime.of(7, 0), y.state.alarms.first().time)
        // 삼십 분이 넘으면 지금 울린 알람 미루기와 같이 다시 묻는다
        val z = say(s, "알람 사십 분 미뤄", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=00:40, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertNotNull(z.state.ringing); assertTrue(z.say!!.contains("삼십 분"))
    }

    @Test fun ringingAlarmDelayedByTargetlessRequestDelay() {
        // 울리는 중 "삼십 분만 뒤로 미뤄"(request delay, 대상 없음): 거절하지 않고 울리는 알람을 미룬다(B6)
        val s = one().let { it.copy(ringing = it.alarms.first()) }
        val t = say(s, "삼십 분만 뒤로 미뤄", "<maum_2>(command=request, operation=delay, target=none, date=none, time=00:30, target_order=none)<maum_end>")
        assertEquals("삼십 분 미뤘어요", t.say)
        assertNull(t.state.ringing)
        assertEquals(LocalTime.of(7, 0), t.state.alarms.first().time)  // 알람 설정 시각은 그대로
        // 삼십 분이 넘으면 지금 울린 알람 미루기와 같이 다시 묻는다
        val u = say(s, "한 시간만 뒤로 미뤄", "<maum_2>(command=request, operation=delay, target=none, date=none, time=01:00, target_order=none)<maum_end>")
        assertNotNull(u.state.ringing); assertTrue(u.say!!.contains("삼십 분"))
        // "앞으로·계속"처럼 알람 시각을 옮기는 말이면 이번 회차 미루기로 바꾸지 않는다
        val v = say(s, "앞으로 계속 삼십 분 뒤로 미뤄", "<maum_2>(command=request, operation=delay, target=none, date=none, time=00:30, target_order=none)<maum_end>")
        assertNotNull(v.state.ringing)
        // 울리지 않을 때는 지금처럼 방금 다룬 알람에 적용한다(일곱 시 알람 → 일곱 시 삼십 분)
        val x = say(one().copy(lastAlarmId = one().alarms.first().id), "삼십 분만 뒤로 미뤄", "<maum_2>(command=request, operation=delay, target=none, date=none, time=00:30, target_order=none)<maum_end>")
        assertTrue("울리지 않을 때 결과: ${x.say}", x.state.ringing == null)
    }

    @Test fun typeAnswerAsSelectAlarmFillsAskedType() {
        // "어떤 알람으로 바꿀까요?"에 "침대 떠나야 꺼지는 알람이요"(select_alarm target_type=leave_bed)로 대답하면 그 종류로 바꾼다
        val a = say(one(), "알람 종류 바꿔 줘", "<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=none, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>")
        assertEquals("alarm_type", a.state.pending?.kind)
        val b = say(a.state, "침대 떠나야 꺼지는 알람이요", "<maum_2>(command=select_alarm, target=none, target_ampm=none, target_days=none, date=none, target_type=leave_bed, target_order=none)<maum_end>")
        assertEquals("leave_bed", b.state.alarms.first().type)
        // 시각까지 말한 대답은 다른 알람을 가리킨 것이라 종류로 쓰지 않는다(바꾸지 않음)
        val c = say(a.state, "일곱 시 덧셈 알람이요", "<maum_2>(command=select_alarm, target=07:00, target_ampm=none, target_days=none, date=none, target_type=question, target_order=none)<maum_end>")
        assertEquals(a.state.alarms.first().type, c.state.alarms.first().type)
        // 종류를 묻지 않을 때의 종류 대답은 아무것도 바꾸지 않는다
        val d = say(one(), "소리만 나는 기본 알람이요", "<maum_2>(command=select_alarm, target=none, target_ampm=none, target_days=none, date=none, target_type=basic, target_order=none)<maum_end>")
        assertEquals(one().alarms, d.state.alarms)
    }

    @Test fun postureNameAnswerAsCallFillsAskedQuestion() {
        // "어느 자세로 저장할까요?"에 "독서로 해 주세요"(call read)로 대답하면 침대를 옮기지 않고 저장 질문으로 이어진다(B4)
        val s = BedState(angles = com.jaljayo.board.brain.Angles(33.0, 7.0), target = com.jaljayo.board.brain.Angles(33.0, 7.0))
        val a = say(s, "이 자세 저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        assertEquals("purpose", a.state.pending?.kind)
        val b = say(a.state, "독서로 해 주세요", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(s.target, b.state.target)             // 움직이지 않음
        assertEquals("save", b.state.pending?.kind)          // 독서 자세로 저장할지 묻는 단계
        // 저장값 초기화에서 자세 이름을 묻는 중에도 같다
        val c = say(s, "자세 초기화해 줘", "<maum_0>(command=reset_default, purpose=none, confirm=no)<maum_end>")
        assertEquals("reset_purpose", c.state.pending?.kind)
        val d = say(c.state, "티비로 해 주세요", "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>")
        assertEquals(s.target, d.state.target); assertEquals("reset", d.state.pending?.kind)
        // 묻는 것이 없으면 지금처럼 그 자세로 옮긴다
        val e = say(s, "독서로 해 주세요", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertTrue(e.state.target != s.target)
        // 묻던 일을 그만두고 옮기라는 새 명령이면 저장 질문을 접고 그 자세로 옮긴다
        val f = say(a.state, "저장 말고 독서 자세로 가 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertTrue(f.state.target != s.target); assertNull(f.state.pending)
        // 옮기기를 부정한 말은 새 이동이 아니라 이름 대답이다
        val g = say(a.state, "옮겨 주지는 말고 독서로 해 주세요", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(s.target, g.state.target); assertEquals("save", g.state.pending?.kind)
        // 옮기기만 말하면(저장을 그만둔다는 말 없음) 저장도 이동도 하지 않고 어느 쪽인지 묻는다
        val h = say(a.state, "독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(s.target, h.state.target); assertEquals(s.memory, h.state.memory)
        assertEquals("save_or_move", h.state.pending?.kind); assertTrue(h.say!!.contains("옮길까요"))
        // 그 질문에 "옮겨 줘"(자세 이름 없는 call)면 방금 물은 독서 자세로 옮기고, "저장해"면 저장 질문으로 간다(바로 저장하지 않음), "아니"면 그만둔다
        val i = say(h.state, "옮겨 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, i.state.purpose); assertNull(i.state.pending)
        // 모델이 이동 명령을 내지 않으면(unclear) 원문에 "옮겨"가 있어도 이전 명령을 다시 쓰지 않고 다시 묻는다
        val i2 = say(h.state, "옮겨 줘", "<maum_3>(reason=unclear)<maum_end>")
        assertEquals(s.target, i2.state.target); assertEquals("save_or_move", i2.state.pending?.kind)
        val j = say(h.state, "저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        assertEquals(s.target, j.state.target); assertEquals("save", j.state.pending?.kind); assertEquals(s.memory, j.state.memory)
        val k = say(h.state, "아니", "<maum_2>(type=no, value=none)<maum_end>")
        assertNull(k.state.pending); assertEquals(s.target, k.state.target)
        // 저장을 그만둔다는 말만 있고 옮기라는 말이 없어도 묻는다
        val l = say(a.state, "저장은 그만두고 독서로", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(s.target, l.state.target); assertEquals("save_or_move", l.state.pending?.kind)
        // 이름만 채운 경우에도 저장은 대답 전에는 하지 않는다
        assertEquals(s.memory, b.state.memory)
    }

    @Test fun saveOrMoveAnswerFollowsNewWordsAndLetsOtherCommandsThrough() {
        // "독서 자세로 저장할까요, 지금 침대를 독서 자세로 옮길까요?"(save_or_move)에 대한 대답들(B4, 코덱스 4차 검토)
        val s = BedState(angles = com.jaljayo.board.brain.Angles(33.0, 7.0), target = com.jaljayo.board.brain.Angles(33.0, 7.0))
        val a = say(s, "이 자세 저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        val q = say(a.state, "독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>").state
        assertEquals("save_or_move", q.pending?.kind)
        fun unchanged(t: Turn) { assertEquals(s.target, t.state.target); assertEquals(s.memory, t.state.memory) }
        // 이름을 고쳐 옮기라고 하면 이전 독서가 아니라 새 잠 자세로 옮긴다
        val b = say(q, "아니 잠 자세로 옮겨 줘", "<maum_0>(command=call, purpose=sleep, confirm=no)<maum_end>")
        assertEquals(Purpose.SLEEP, b.state.purpose); assertNull(b.state.pending)
        // 새 말이 바람(confirm=yes)이면 그 확인 여부를 지켜 바로 옮기지 않고 묻는다
        val b2 = say(q, "아니 잠 자세로 옮겼으면 해", "<maum_0>(command=call, purpose=sleep, confirm=yes)<maum_end>")
        unchanged(b2); assertTrue(b2.state.pending != null && b2.state.pending!!.kind != "save_or_move")
        // 이름을 고쳐 저장하라고 하면 새 이름의 저장 질문으로 간다(바로 저장하지 않음)
        val c = say(q, "잠 자세로 저장해", "<maum_0>(command=set_default, purpose=sleep, confirm=no)<maum_end>")
        unchanged(c); assertEquals("save", c.state.pending?.kind); assertTrue(c.state.pending!!.output.contains("purpose=sleep"))
        // 옮기기를 부정하면 모델이 call을 내도 옮기지 않는다(다시 물음)
        val d = say(q, "옮기는 건 싫어", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(d); assertEquals("save_or_move", d.state.pending?.kind)
        // 이름만 말하거나 "응"이면 어느 쪽인지 정하지 않았으므로 아무것도 하지 않고 다시 묻는다
        val e = say(q, "잠 자세", "<maum_0>(command=call, purpose=sleep, confirm=no)<maum_end>")
        unchanged(e); assertEquals("save_or_move", e.state.pending?.kind); assertTrue(e.say!!.contains("잠 자세"))
        val f = say(q, "응", yes)
        unchanged(f); assertEquals("save_or_move", f.state.pending?.kind)
        // 둘 다 부정하면 그만둔다
        val g = say(q, "저장 안 할래 옮기지도 마", "<maum_2>(type=no, value=none)<maum_end>")
        unchanged(g); assertNull(g.state.pending)
        val g2 = say(q, "저장하지 않을래 옮기는 것도 필요 없어", "<maum_3>(reason=unclear)<maum_end>")
        unchanged(g2); assertNull(g2.state.pending)
        // 대화를 끝내면 그만둔다
        val h = say(q, "그만하자", "<maum_2>(type=cancel, value=none)<maum_end>")
        unchanged(h); assertNull(h.state.pending)
        // 두 선택과 무관한 새 명령은 질문을 접고 그 명령을 처리한다
        val i = say(q, "오전 일곱 시 알람 맞춰", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertEquals(1, i.state.alarms.size); assertNull(i.state.pending)
        // [5차] 다른 자세를 부정한 정정은 막지 않고 끝까지 처리한다
        val m1 = say(q, "독서 말고 잠 자세로 옮겨 줘", "<maum_0>(command=call, purpose=sleep, confirm=no)<maum_end>")
        assertEquals(Purpose.SLEEP, m1.state.purpose); assertNull(m1.state.pending)
        // [5차] 짧은 대답 "저장해"(자세 이름 없음)는 방금 물은 독서만 이어받아 저장 질문으로 간다
        val m2 = say(q, "저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        unchanged(m2); assertEquals("save", m2.state.pending?.kind); assertTrue(m2.state.pending!!.output.contains("purpose=read"))
        // [5차] 목록 밖 부정("옮겨 주실 필요는 없어요")은 call이 와도 옮기지 않는다
        val m3 = say(q, "옮겨 주실 필요는 없어요", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(m3); assertEquals("save_or_move", m3.state.pending?.kind)
        // [5차] 앞에서 옮기라 했다가 마지막에 철회하면: 모델이 취소로 판정하면 그만두고, call로 내도 옮기지 않는다
        val m4 = say(q, "옮겨 줘 아니 그냥 그만하자", "<maum_2>(type=cancel, value=none)<maum_end>")
        unchanged(m4); assertNull(m4.state.pending)
        val m5 = say(q, "옮겨 줘 아니 그냥 그만하자", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(m5); assertEquals("save_or_move", m5.state.pending?.kind)
        // [5차] 부정 낱말 없이 철회만 한 말("옮겨 줘 그냥 관두자")도 call이 와도 옮기지 않는다
        val m5b = say(q, "옮겨 줘 그냥 관두자", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(m5b); assertEquals("save_or_move", m5b.state.pending?.kind)
        // [5차] 저장을 부정했는데 모델이 저장 명령을 내도 저장 질문으로 가지 않는다
        val m5c = say(q, "저장은 하지 마", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        unchanged(m5c); assertEquals("save_or_move", m5c.state.pending?.kind)
        // [6차] 문장 속 "됐어"("준비됐어")는 철회가 아니다: 끝까지 옮긴다
        val n1 = say(q, "준비됐어 독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, n1.state.purpose); assertNull(n1.state.pending)
        // [6차] 한 작업만 거절("저장은 안 할래")하고 다른 작업을 고르면 그 작업을 한다(자세 이름이 없으면 방금 물은 독서)
        val n2 = say(q, "저장은 안 할래, 대신 옮겨 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, n2.state.purpose); assertNull(n2.state.pending)
        // [6차] 정정에서 부정한 자세를 모델이 그대로 내면(독서 말고 … 인데 call read) 실행하지 않는다
        val n3 = say(q, "독서 말고 잠 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(n3); assertEquals("save_or_move", n3.state.pending?.kind)
        val n4 = say(q, "독서 말고 잠 자세로 저장해", "<maum_0>(command=set_default, purpose=read, confirm=no)<maum_end>")
        unchanged(n4); assertEquals("save_or_move", n4.state.pending?.kind)
        // [6차] 이어받을 자세가 유효한 자세 값이 아니면(평평) 이름 없는 대답을 실행하지 않는다
        val bad = q.copy(pending = q.pending!!.copy(question = "<maum_0>(command=call, purpose=flat, confirm=no)<maum_end>", output = "<maum_0>(command=set_default, purpose=flat, confirm=no)<maum_end>"))
        val n5 = say(bad, "옮겨 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        unchanged(n5); assertEquals("save_or_move", n5.state.pending?.kind)
        val n6 = say(bad, "저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        unchanged(n6); assertEquals("save_or_move", n6.state.pending?.kind)
        // [7차] 여러 번 고쳐 말하면 마지막 선택을 쓴다("독서 말고 잠, 아니 독서 자세로" → 독서)
        val k1 = say(q, "독서 말고 잠, 아니 독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, k1.state.purpose); assertNull(k1.state.pending)
        val k2 = say(q, "독서 말고 잠, 아니 독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=sleep, confirm=no)<maum_end>")
        unchanged(k2); assertEquals("save_or_move", k2.state.pending?.kind)
        // [7차] 철회하는 말이 앞에 있어도 무엇을 철회했는지 알 수 없으면 실행도 취소도 하지 않고 다시 묻는다
        val k3 = say(q, "그만하자, 옮겨 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        unchanged(k3); assertEquals("save_or_move", k3.state.pending?.kind)
        // [7차] 부정된 자세만 있고 최종 선택이 없으면 실행하지 않는다
        val k4 = say(q, "독서 말고 옮겨 줘", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>")
        unchanged(k4); assertEquals("save_or_move", k4.state.pending?.kind)
        // [8차] 배경으로 다른 자세를 말하면(긍정된 자세 값이 둘) 어느 쪽인지 판단하지 않고 다시 묻는다
        val e1 = say(q, "독서 자세로 옮겨 줘. 잠 자세는 어제 썼어", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(e1); assertEquals("save_or_move", e1.state.pending?.kind)
        // [8차] 마지막에 철회하고 대체 자세가 없으면 앞의 선택을 되살리지 않는다
        val e2 = say(q, "독서 자세로 옮겨 줘. 아니 독서는 말고", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(e2); assertEquals("save_or_move", e2.state.pending?.kind)
        val e2b = say(q, "독서 자세로 옮겨 줘 독서는 말고", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        unchanged(e2b); assertEquals("save_or_move", e2b.state.pending?.kind)
        // [8차] 같은 자세를 여러 번 말한 것은 하나로 센다(서로 다른 값의 수)
        val e3 = say(q, "독서, 그래 독서 자세로 옮겨 줘", "<maum_0>(command=call, purpose=read, confirm=no)<maum_end>")
        assertEquals(Purpose.READ, e3.state.purpose); assertNull(e3.state.pending)
        // [5차] 바람 말투가 unclear로 나오면 이전 명령(confirm=no)을 다시 쓰지 않고 다시 묻는다
        val m6 = say(q, "옮겼으면 해", "<maum_3>(reason=unclear)<maum_end>")
        unchanged(m6); assertEquals("save_or_move", m6.state.pending?.kind)
        // [5차] 지원 밖 요청은 질문을 접고 원래 안내로, 망설임은 질문을 둔 채 기다린다
        val m7 = say(q, "에어컨 켜 줘", "<maum_3>(reason=out_of_scope)<maum_end>")
        unchanged(m7); assertNull(m7.state.pending)
        val m8 = say(q, "음 잠깐만", "<maum_2>(type=wait, value=none)<maum_end>")
        unchanged(m8); assertEquals("save_or_move", m8.state.pending?.kind)
        // [5차] 되돌리기를 묻던 중 "초기화 말고 지금 자세를 저장해"는 이전 되돌리기가 아니라 새 저장 요청으로 간다
        val r0 = say(s, "자세 초기화해 줘", "<maum_0>(command=reset_default, purpose=none, confirm=no)<maum_end>")
        val rq = say(r0.state, "티비 자세로 옮겨 줘", "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>").state
        assertEquals("save_or_move", rq.pending?.kind)
        val m9 = say(rq, "초기화 말고 지금 자세를 저장해", "<maum_0>(command=set_default, purpose=none, confirm=no)<maum_end>")
        unchanged(m9); assertEquals("save", m9.state.pending?.kind); assertTrue(m9.state.pending!!.output.contains("set_default") && m9.state.pending!!.output.contains("purpose=tv"))
        // 움직이는 중에 그만하라고 하면 멈춘다
        val moving = q.copy(target = com.jaljayo.board.brain.Angles(60.0, 7.0))
        val j = say(moving, "멈춰", "<maum_2>(type=cancel, value=none)<maum_end>")
        assertTrue(!j.state.moving); assertNull(j.state.pending)
    }

    @Test fun postureMentionsUseWordBoundaries() {
        // [7차] 자세 이름 뒤에는 정해 둔 조사나 '자세·모드'만 온다. "잠깐"·"책상"·"쉬는 날"·"평평하게"는 자세 이름이 아니다
        assertEquals(listOf("read" to false), brain.postureMentions("잠깐 말고 책상에서 독서 자세로 해 줘"))
        assertEquals(emptyList<Pair<String, Boolean>>(), brain.postureMentions("쉬는 날이라 평평하게 해 줘"))
        assertEquals(listOf("read" to true, "sleep" to true, "read" to false), brain.postureMentions("독서 말고 잠, 아니 독서 자세로 옮겨 줘"))
        assertEquals(listOf("tv" to true, "rest" to false), brain.postureMentions("티비 자세 아니고 쉬는 자세로"))
        assertEquals(listOf("sleep" to false), brain.postureMentions("잠 자세요"))
    }

    @Test fun sleepReservationMatchesSleepAndFlatNames() {
        // '잠 자세로 예약'(sleep) 뒤 '잠 예약 날려줘'(flat)도, '열한시에 잘게'(flat) 뒤 '잠 자세 예약 취소해'(sleep)도 같은 잠 예약을 취소한다(B5)
        val sleep = say(BedState(), "삼십 분 뒤에 잠 자세로 바꿔", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=no)<maum_end>").state
        assertNotNull(sleep.reservation)
        assertNull(say(sleep, "잠 예약 날려줘", "<maum_0>(command=cancel_reserve, purpose=flat, confirm=no)<maum_end>").state.reservation)
        val flat = say(BedState(), "삼십분 뒤에 잘게", "<maum_0>(command=reserve, purpose=flat, date=none, ampm=none, time=00:30, time_type=relative, confirm=no)<maum_end>").state
        assertNotNull(flat.reservation)
        assertNull(say(flat, "잠 자세 예약 취소해", "<maum_0>(command=cancel_reserve, purpose=sleep, confirm=no)<maum_end>").state.reservation)
        // '평평한 자세 예약 취소'처럼 평평이라고 말하면 잠 자세 예약은 취소하지 않는다
        assertNotNull(say(sleep, "평평한 자세 예약 취소", "<maum_0>(command=cancel_reserve, purpose=flat, confirm=no)<maum_end>").state.reservation)
        // 다른 자세 이름은 지금처럼 거절한다
        assertNotNull(say(sleep, "독서 자세 예약 취소", "<maum_0>(command=cancel_reserve, purpose=read, confirm=no)<maum_end>").state.reservation)
    }

    @Test fun bareTimeWithoutQuestionAsksBeforeSetting() {
        // 묻는 것이 없을 때 "여섯 시 이십칠 분에 맞춰"(time 대답): 바로 만들지 않고 오전 오후와 동의를 물은 뒤 만든다
        val s = BedState()
        val a = say(s, "여섯시 이십칠분에 맞춰라", "<maum_2>(type=time, value=06:27)<maum_end>")
        assertTrue(a.state.alarms.isEmpty())
        assertEquals("ampm", a.state.pending?.kind)
        val b = say(a.state, "응", yes)
        assertTrue("오전 오후를 정한 뒤에도 바로 만들지 않음: ${b.say}", b.state.alarms.isEmpty())
        assertEquals("confirm", b.state.pending?.kind)
        val c = say(b.state, "응", yes)
        assertEquals(LocalTime.of(6, 27), c.state.alarms.single().time)
        // 오전 오후를 말한 시각은 오전 오후 질문 없이 동의만 묻는다
        val d = say(s, "저녁 여섯 시로 맞춰 주세요", "<maum_2>(type=time, value=pm_06:00)<maum_end>")
        assertEquals("confirm", d.state.pending?.kind)
        assertTrue(d.state.alarms.isEmpty())
        // 시각을 묻는 중이면 지금처럼 그 질문에 채운다
        val e = say(s, "알람 맞춰 줘", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>")
        assertEquals("set_time", e.state.pending?.kind)
        val f = say(e.state, "오전 여섯 시요", "<maum_2>(type=time, value=am_06:00)<maum_end>")
        assertEquals(LocalTime.of(6, 0), f.state.alarms.single().time)
    }
}
