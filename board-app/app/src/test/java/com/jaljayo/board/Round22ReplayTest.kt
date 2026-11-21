package com.jaljayo.board

import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Pending
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

// 11/14 22차 준비: 21차 모델 오답 123개(indep·prev·epoch)의 모델 출력(pred)과 정답(gold)을 같은 상황의 보드 두뇌에 넣어 보드가 실제로 하는 일을 비교한다.
// 상황은 make_items.py가 만든 명령을 보드에 차례로 넣어 만든다. 그래서 [앞 대답]·[앞 질문]은 보드가 실제로 한 말이다(시험지 문장과 다르면 "재현 불일치"로 적는다).
// 알람 [앞 대답]이 있는 문제는 두 상황에서 돌린다. A: 앞 대답의 알람만 있음. B: 같은 시각 알람이 사흘 뒤(오전·오후 둘)에도 있음.
// 지금 시각은 2026-11-16(월) 오후 3시, 앞 대답 뒤 20초(부르는 말 + 말하기)가 지난 때로 본다. 되물으면 "응"까지 이어 넣는다.
// 결과는 round22/board/replay_latest.json. 이 시험의 통과는 재생이 오류 없이 돌았다는 뜻이고 오답이 고쳐졌다는 뜻이 아니다.
class Round22ReplayTest {
    private val dir = File("${System.getProperty("user.home")}/GoodNight/ai-training-v5/reports/next-step-1107/round22/board")
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val t0 = LocalDateTime.of(2026, 11, 16, 15, 0).atZone(KST).toInstant().toEpochMilli()
    private var nowMs = t0
    private val brain = Brain { nowMs }
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"

    private fun ok(out: String) = (spec.parse(Spec.upgrade(out)) as Spec.Result.Ok).cmd
    private fun step(s: BedState, heard: String, out: String): Pair<BedState, String> {
        val t = brain.recordAsked(s, brain.handleSafely(s, heard, ok(out), out))
        val say = t.say.ifEmpty { t.state.after }
        return t.state.copy(angles = t.state.target, after = "") to say
    }

    private fun base(name: String): BedState {
        nowMs = t0
        var s = step(BedState(), "티비 자세", "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>").first
        s = s.copy(memory = mapOf(com.jaljayo.board.brain.Purpose.TV to s.target))
        if (name == "empty") return s
        s = step(s, "평일 일곱 시", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=leave_bed, repeat=weekly, days=weekdays, confirm=no)<maum_end>").first
        s = step(s, "주말 여덟 시", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=question, repeat=weekly, days=weekend, confirm=no)<maum_end>").first
        s = step(s, "열한 시 반 잠", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute, confirm=no)<maum_end>").first
        nowMs = t0 + 60_000   // 기본 상황을 만든 말은 1분 전 일이라 "방금 이야기한 알람"·[앞 대답]이 아니다
        s = s.copy(lastAlarmId = null, lastAlarmUntil = 0L)
        return when (name) {
            "ring" -> s.copy(ringing = s.alarms.first())
            "ring_q" -> s.copy(ringing = s.alarms.last())
            else -> s
        }
    }

    private class Built(val state: BedState, val said: String, val same: Boolean)

    private fun build(it: JSONObject): Built {
        var s = base(it.getString("base"))
        var said = ""
        val setup = it.getJSONArray("setup")
        for (i in 0 until setup.length()) {
            val st = setup.get(i)
            if (st is JSONArray) { val r = step(s, st.getString(0), st.getString(1)); s = r.first; said = r.second }
            else if (st is JSONObject && st.has("pending")) {
                val p = st.getJSONObject("pending")
                s = s.copy(pending = Pending(p.getString("kind"), p.getString("output"), p.getString("heard"), question = p.getString("asked"), asked = p.getString("asked")))
                said = p.getString("asked")
            } else if (st is JSONObject && st.has("question")) {
                val q = st.getJSONArray("question")
                s = s.copy(question = q.getInt(0) to q.getInt(1), questionSaid = "")
                said = brain.waitingQuestion(s) ?: ""
            }
        }
        val expect = it.getString("expect")
        val shown = if (it.getString("pq") != "없음") brain.waitingQuestion(s) ?: "" else said
        if (it.optBoolean("moving")) s = s.copy(moveStart = s.angles, target = s.target.copy(head = (s.target.head + 20).coerceAtMost(60.0)), after = "머리를 올렸어요")
        nowMs += 20_000
        return Built(s, shown, expect.isEmpty() || shown == expect)
    }

    /** B 상황: 앞 대답 알람과 같은 시각(오전·오후 둘)의 한 번 알람이 사흘 뒤에도 있다 */
    private fun withLookalikes(s: BedState, before: Set<Int>): BedState {
        var id = (s.alarms.maxOfOrNull { it.id } ?: 0) + 1
        val add = mutableListOf<AlarmItem>()
        for (a in s.alarms.filter { it.id !in before && it.onceDate != null }.distinctBy { it.time to it.onceDate }) {
            val d = a.onceDate!!.plusDays(3)
            add += AlarmItem(id++, a.time, onceDate = d)
            add += AlarmItem(id++, a.time.plusHours(12), onceDate = d)
        }
        return s.copy(alarms = s.alarms + add)
    }

    private fun act(a: BedState) = listOf(a.target, a.alarms, a.reservation, a.memory, a.ringing, a.question, a.snoozeAt, a.volume).toString()
    private fun changed(s: BedState, a: BedState): List<String> {
        val ch = mutableListOf<String>()
        if (a.target != s.target) ch += "움직임"
        if (a.alarms != s.alarms) ch += "알람"
        if (a.reservation != s.reservation) ch += "예약"
        if (a.memory != s.memory) ch += "저장"
        if (a.ringing != s.ringing || a.snoozeAt != s.snoozeAt || a.question != s.question) ch += "울림"
        if (a.volume != s.volume) ch += "소리 크기"
        return ch
    }

    private class Out(val j: JSONObject, val now: String, val fin: String, val nowCh: Boolean, val asked: Boolean, val finCh: Boolean)

    private fun run(s: BedState, heard: String, out: String): Out {
        val j = JSONObject()
        if (spec.parse(Spec.upgrade(out)) !is Spec.Result.Ok) {
            val say = brain.reask(s, heard)?.say ?: "다시 한 번 말씀해 주세요"
            return Out(j.put("say", say).put("note", "출력 형식 검사 탈락"), act(s), act(s), false, true, false)
        }
        val t: Turn = brain.handleSafely(s, heard, ok(out), out)
        val a = t.state
        val say = t.say.ifEmpty { a.after }
        val asked = a.pending != null || t.say.trim().endsWith("?")
        j.put("say", say).put("note", t.note).put("changed", JSONArray(changed(s, a))).put("pending", a.pending?.let { it.kind + " " + it.output } ?: "")
        // 되물으면 "응"을 세 번까지 이어 넣는다(오전·오후 확인 뒤 다시 확인을 묻는 경우). 같은 것을 다시 물으면 멈춘다
        var fin = a
        val yesSays = JSONArray()
        for (k in 0 until 3) {
            val p0 = fin.pending ?: break
            val y = brain.recordAsked(fin, brain.handleSafely(fin, "응", ok(yes), yes))
            yesSays.put(y.say.ifEmpty { y.state.after })
            val again = y.state.pending?.let { it.kind == p0.kind && it.output == p0.output } == true
            fin = y.state
            if (again) break
        }
        if (yesSays.length() > 0) j.put("yes_say", yesSays).put("yes_changed", JSONArray(changed(s, fin)))
        return Out(j, act(a), act(fin), changed(s, a).isNotEmpty(), asked, changed(s, fin).isNotEmpty())
    }

    private fun category(p: Out, g: Out): Pair<String, String> = when {
        p.fin == g.fin && p.now == g.now -> "같음" to (if (p.j.getString("say") == g.j.getString("say")) "말도 같음" else "말만 다름")
        p.fin == g.fin -> "같음" to "묻는 단계만 다름"
        p.nowCh -> "잘못 실행" to (if (g.nowCh || g.finCh) "다른 일을 함" else "정답은 바꾸지 않는데 바꿈")
        p.asked && p.finCh -> "되묻기로 끝남" to "되물음(응 하면 다른 일)"
        p.asked -> "되묻기로 끝남" to "되물음"
        else -> "되묻기로 끝남" to (if (g.finCh) "안내만 하고 할 일을 못 함" else "안내만(말이 다름)")
    }

    @Test fun replay() {
        val f = File(dir, "items.json")
        assumeTrue(f.exists())
        val items = JSONArray(f.readText())
        val res = JSONArray()
        val count = LinkedHashMap<String, Int>()
        var mismatch = 0
        for (i in 0 until items.length()) {
            val it = items.getJSONObject(i)
            val row = JSONObject().put("id", it.getString("id")).put("set", it.getString("set")).put("u", it.getString("u"))
                .put("pr", it.getString("pr")).put("pq", it.getString("pq")).put("state", it.getString("state"))
                .put("pred", it.getString("pred")).put("gold", it.getString("gold")).put("diff", it.getJSONArray("diff"))
            val scen = linkedMapOf<String, BedState>()
            val b = build(it)
            row.put("board_said", b.said).put("same_context", b.same)
            if (!b.same) mismatch++
            scen["A"] = b.state
            if (it.getBoolean("alarm_reply")) {
                val before = base("empty").alarms.map { a -> a.id }.toSet()
                val bb = build(it)
                scen["B"] = withLookalikes(bb.state, before)
            }
            for ((name, s) in scen) {
                val n0 = nowMs
                val p = run(s, it.getString("u"), it.getString("pred")); nowMs = n0
                val g = run(s, it.getString("u"), it.getString("gold")); nowMs = n0
                val (cat, sub) = category(p, g)
                row.put(name, JSONObject().put("category", cat).put("sub", sub).put("pred", p.j).put("gold", g.j))
                count.merge("$name $cat", 1, Int::plus)
            }
            if (!scen.containsKey("B")) row.put("B", row.getJSONObject("A"))
            count.merge("B(합침) " + row.getJSONObject("B").getString("category"), 1, Int::plus)
            res.put(row)
        }
        File(dir, "replay_latest.json").writeText(res.toString(1))
        println("재생 ${items.length()}개, 재현 불일치 $mismatch, $count")
        assertEquals(123, items.length())
    }
}
