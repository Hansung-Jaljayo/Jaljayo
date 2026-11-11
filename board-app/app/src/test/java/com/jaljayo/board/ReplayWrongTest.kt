package com.jaljayo.board

import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Spec
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

// 모델 오답을 두뇌에 넣어 무엇이 달라지는지 잰다. 같은 상황에서 정답을 넣은 결과와 비교한다.
// 대답 문장, 대기 중인 질문, 이후 동작에 영향을 주는 상태까지 비교하고, 되물으면 "응"까지 이어 넣는다.
// 말 듣기와 단독 정지 말 처리는 거치지 않는다. 이 시험의 통과는 재생이 오류 없이 돌았다는 뜻이고, 오답이 고쳐졌다는 뜻이 아니다.
class ReplayWrongTest {
    private val dir = File("/Users/lumos/GoodNight/ai-training-v5/reports/v08-7-wrong-table-1102")
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val brain = Brain { LocalDateTime.of(2026, 11, 2, 22, 0).atZone(KST).toInstant().toEpochMilli() }
    private val yes = "<maum_2>(type=yes, value=none)<maum_end>"

    private fun ok(out: String) = (spec.parse(Spec.upgrade(out)) as Spec.Result.Ok).cmd
    private fun run(s: BedState, list: List<Pair<String, String>>): BedState {
        var x = s
        for ((h, o) in list) x = brain.handle(x, h, ok(o), o).state.let { it.copy(angles = it.target, after = "", pending = null) }
        return x
    }
    private fun wait(s: BedState, heard: String, out: String, kind: String): BedState {
        val a = brain.handle(s, heard, ok(out), out).state
        assertEquals("$heard 뒤 대기 종류", kind, a.pending?.kind)
        return a
    }

    private val alarmWeekday = "평일 일곱 시" to "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=leave_bed, repeat=weekly, days=weekdays, confirm=no)<maum_end>"
    private val alarmWeekend = "주말 여덟 시" to "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=question, repeat=weekly, days=weekend, confirm=no)<maum_end>"
    private val callTv = "티비 자세" to "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>"
    private val reserve = "열한 시 반 잠" to "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute, confirm=no)<maum_end>"

    // 저장값이 있는 상황은 저장 동의 절차와 상관없이 같은 상태가 되도록 직접 넣는다(수정 전 재생과 같은 상태)
    private fun fullState() = run(BedState(), listOf(callTv, alarmWeekday, alarmWeekend, reserve))
        .let { it.copy(lastAlarmId = null, memory = mapOf(Purpose.TV to it.target)) }

    private fun scenarios(): Map<String, BedState> {
        val one = run(BedState(), listOf(alarmWeekday)).copy(lastAlarmId = null)
        val full = fullState()
        return linkedMapOf(
            "빈 상태" to BedState(),
            "알람 하나" to one,
            "알람 둘, 예약, 저장값" to full,
            "알람 울리는 중" to full.copy(ringing = full.alarms.first()),
            "움직이는 중" to full.copy(target = full.target.copy(head = full.target.head + 20)),
            "꺼 둔 알람 하나" to one.copy(alarms = one.alarms.map { it.copy(enabled = false) }),
            "방금 다룬 알람 있음" to full.copy(lastAlarmId = full.alarms.last().id, lastAlarmUntil = Long.MAX_VALUE),
            "대기: 먼저 묻기" to wait(full, "머리가 좀 낮네", "<maum_0>(command=adjust, part=head, direction=up, amount=small, amount_type=delta, confirm=yes)<maum_end>", "confirm"),
            "대기: 부위" to wait(one, "좀 올려", "<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none, confirm=no)<maum_end>", "part"),
            "대기: 대상 알람" to wait(full, "알람 삭제해", "<maum_1>(command=delete, target=none, target_ampm=none, target_days=none, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>", "alarm"),
            "대기: 시각" to wait(one, "알람 맞춰 줘", "<maum_1>(command=set, date=none, ampm=none, time=none, time_type=none, type=none, repeat=none, days=none, confirm=no)<maum_end>", "set_time"),
            "대기: 오전 오후" to wait(one, "일곱 시에 깨워 줘", "<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>", "ampm"),
        )
    }

    private class R(val j: JSONObject, val act: String, val state: BedState?)

    // 몸에 닿거나 저장되는 것(되돌리기 어려운 것 포함)
    private fun act(a: BedState) = listOf(a.target, a.alarms, a.reservation, a.memory, a.ringing, a.question, a.snoozeAt).toString()

    private fun outcome(s: BedState, heard: String, out: String): R {
        val j = JSONObject()
        if (spec.parse(Spec.upgrade(out)) !is Spec.Result.Ok) {
            return R(j.put("kind", "검사 탈락").put("say", brain.reask(s, heard)?.say ?: "다시 한 번 말씀해 주세요").put("pending", "").put("full", "bad"), act(s), null)
        }
        val t = try { brain.handle(s, heard, ok(out), out) } catch (e: Exception) {
            return R(j.put("kind", "두뇌 오류").put("say", e.toString()).put("pending", "").put("full", "error"), act(s), null)
        }
        val a = t.state
        val ch = changed(s, a)
        val say = if (t.say.isNotEmpty()) t.say else a.after
        val kind = when {
            ch.isNotEmpty() -> "실행"
            a.pending != null || t.say.trim().endsWith("?") -> "되물음"
            t.say.isNotEmpty() -> "말만"
            else -> "무시"
        }
        return R(j.put("kind", kind).put("changed", JSONArray(ch)).put("say", say).put("note", t.note)
            .put("pending", a.pending?.let { it.kind + " " + it.output } ?: "")
            .put("full", a.copy(lastSpeech = "", after = "").toString()), act(a), a)
    }

    private fun changed(s: BedState, a: BedState): List<String> {
        val ch = mutableListOf<String>()
        if (a.target != s.target) ch += "움직임"
        if (a.alarms != s.alarms) ch += "알람"
        if (a.reservation != s.reservation) ch += "예약"
        if (a.memory != s.memory) ch += "저장"
        if (a.ringing != s.ringing || a.snoozeAt != s.snoozeAt || a.question != s.question) ch += "울림"
        return ch
    }

    // 되물었으면 "응"을 이어 넣은 최종 결과
    private fun afterYes(s: BedState, r: R): Pair<String, JSONObject> {
        val a = r.state
        if (a == null || a.pending == null) return r.act to JSONObject().put("asked", false).put("changed", r.j.optJSONArray("changed") ?: JSONArray()).put("say", r.j.getString("say"))
        val t = brain.handle(a, "응", ok(yes), yes)
        val say = if (t.say.isNotEmpty()) t.say else t.state.after
        return act(t.state) to JSONObject().put("asked", true).put("changed", JSONArray(changed(s, t.state))).put("say", say)
    }

    private fun category(p: R, g: R, pf: Pair<String, JSONObject>, gf: Pair<String, JSONObject>): String {
        if (p.j.getString("kind") == "두뇌 오류") return "두뇌 오류"
        if (g.j.getString("kind") == "두뇌 오류") return "정답에서 두뇌 오류"
        if (p.j.getString("kind") == "검사 탈락") return "검사 탈락"
        val nowCh = p.j.getJSONArray("changed").length() > 0
        val finalPred = pf.second.getJSONArray("changed").length() > 0
        val finalGold = gf.second.getJSONArray("changed").length() > 0
        return when {
            nowCh && p.act != g.act -> "바로 잘못 실행"
            pf.first != gf.first && finalPred -> "응 뒤 잘못 실행"
            pf.first != gf.first && finalGold -> "할 일을 못 함"
            p.j.getString("full") != g.j.getString("full") -> if (p.j.getString("pending") != g.j.getString("pending")) "대기 내용 다름" else "상태 다름"
            p.j.getString("say") != g.j.getString("say") -> "말이 다름(상태 같음)"
            else -> "완전 같음"
        }
    }

    private fun compare(s: BedState, heard: String, pred: String, gold: String): JSONObject {
        val p = outcome(s, heard, pred); val g = outcome(s, heard, gold)
        val pf = afterYes(s, p); val gf = afterYes(s, g)
        return JSONObject().put("pred", p.j).put("gold", g.j).put("pred_yes", pf.second).put("gold_yes", gf.second)
            .put("category", category(p, g, pf, gf))
    }

    @Test fun replay() {
        val base = File(dir, "base.json")
        assumeTrue(base.exists())
        val rows = JSONArray(base.readText())
        val ss = scenarios()
        val full = ss.getValue("알람 둘, 예약, 저장값")
        val res = JSONArray()
        var crash = 0
        for (i in 0 until rows.length()) {
            val r = rows.getJSONObject(i)
            val heard = r.getString("utterance"); val pred = r.getString("pred"); val gold = r.getString("gold")
            val row = JSONObject().put("id", r.getString("id")).put("set", r.getString("set"))
            val per = LinkedHashMap(ss)
            // 덧셈 답을 기다리는 중: 정답 숫자가 그 문제의 답이 되게 문제를 만든다
            Regex("type=number, value=(\\d+)").find(gold)?.let { m ->
                val v = m.groupValues[1].toInt()
                // 문제는 두 자리끼리 더하기까지라 답이 198을 넘으면 이 상황은 없다
                if (v in 2..198) per["대기: 덧셈 답"] = full.copy(ringing = full.alarms.last(), question = (v / 2) to (v - v / 2))
            }
            for ((name, s) in per) {
                try { row.put(name, compare(s, heard, pred, gold)) }
                catch (e: Exception) { crash++; println("재생 오류 $heard / $name: $e"); row.put(name, JSONObject().put("error", e.toString())) }
            }
            res.put(row)
        }
        File(dir, "replay.json").writeText(res.toString(1))
        println("돌린 오답 ${rows.length()}, 기본 상황 ${ss.size}, 오류 $crash")
        assertEquals(0, crash)
        assertEquals(175, rows.length())
    }

    // 덧셈 답을 기다리는 중(15 + 18 = 33): 정답 말과 모델이 잘못 옮긴 숫자의 결과를 비교한다
    @Test fun numberAnswerDecidesAlarm() {
        val full = run(BedState(), listOf(alarmWeekend))
        val s = full.copy(ringing = full.alarms.first(), question = 15 to 18)
        val right = "<maum_2>(type=number, value=33)<maum_end>"
        val wrong = "<maum_2>(type=number, value=63)<maum_end>"
        val a = brain.handle(s, "삼십삼이 정답이야", ok(right), right)
        val b = brain.handle(s, "삼십삼이 정답이야", ok(wrong), wrong)
        assertEquals(null, a.state.ringing)
        assertEquals(null, b.state.ringing)   // 11/10 B7: 들은 수가 하나(33)면 모델 숫자(63) 대신 그 수로 판정한다
    }

    // 덧셈 답은 사용자가 마지막에 답으로 말한 수 하나로만 판정한다(11/03). 애매하거나 모델 숫자와 다르면 끄지도 오답이라 하지도 않고 다시 묻는다
    @Test fun numberAnswerUsesFinalSpokenValue() {
        val full = run(BedState(), listOf(alarmWeekend))
        fun num(v: Int) = "<maum_2>(type=number, value=$v)<maum_end>"
        fun asksAgain(t: com.jaljayo.board.brain.Turn) { assertEquals(true, t.state.ringing != null); assertEquals(true, t.say.startsWith("다시 한 번 말씀해 주세요")) }
        val s62 = full.copy(ringing = full.alarms.first(), question = 31 to 31)
        // "육십이요": 60과 62가 모두 가능 → 모델이 무엇을 내든, 정답이 62여도 판정하지 않고 두 값을 짚어 '요' 없이 다시 말해 달라고 한다
        fun asksWhich(t: com.jaljayo.board.brain.Turn) { assertEquals(true, t.state.ringing != null); assertEquals("육십인지 육십이인지 헷갈려요. 끝에 요 없이 숫자만 말씀해 주세요.", t.say) }
        asksWhich(brain.handle(s62, "육십이요", ok(num(62)), num(62)))
        asksWhich(brain.handle(s62, "육십이요", ok(num(60)), num(60)))
        // 다시 물은 뒤 '요' 없이 말하면 하나로 정해져 판정한다
        assertEquals(null, brain.handle(s62, "육십이", ok(num(62)), num(62)).state.ringing)
        assertEquals(true, brain.handle(s62, "육십", ok(num(60)), num(60)).say.startsWith("다시 생각해 보세요"))
        // "육십 아니 육십이입니다": 마지막 답 62만 본다. 모델이 앞에서 말한 60을 내면 통과시키지 않는다
        assertEquals(null, brain.handle(s62, "육십 아니 육십이입니다", ok(num(60)), num(60)).state.ringing)   // 11/10 B7: 마지막 답 62로 판정
        assertEquals(null, brain.handle(s62, "육십 아니 육십이입니다", ok(num(62)), num(62)).state.ringing)
        // "백이야"인데 모델이 200(자릿수 오류) → 다시 묻는다. "백이야"는 100·102 모두 가능해 100이어도 다시 묻는다
        val s100 = full.copy(ringing = full.alarms.first(), question = 50 to 50)
        assertEquals("백인지 백이인지 헷갈려요. 끝에 요 없이 숫자만 말씀해 주세요.", brain.handle(s100, "백이야", ok(num(200)), num(200)).say)
        assertEquals("백인지 백이인지 헷갈려요. 끝에 요 없이 숫자만 말씀해 주세요.", brain.handle(s100, "백이야", ok(num(100)), num(100)).say)
        assertEquals(null, brain.handle(s100, "답은 백", ok(num(200)), num(200)).state.ringing)   // 11/10 B7: 들은 수 100으로 판정
        assertEquals(null, brain.handle(s100, "답은 백", ok(num(100)), num(100)).state.ringing)
        // 분명한 오답은 오답으로 안내한다
        assertEquals(true, brain.handle(s100, "구백구십구요", ok(num(999)), num(999)).say.startsWith("다시 생각해 보세요"))
        assertEquals(true, brain.handle(s100, "구백구십구요", ok(num(979)), num(979)).say.startsWith("다시 생각해 보세요"))   // 11/10 B7: 들은 수 999로 판정(오답)
        for ((t, want) in listOf("육십이요" to listOf(60, 62), "백이야" to listOf(100, 102), "육십이에요" to listOf(60, 62), "육십이" to listOf(62),
                "육십이입니다" to listOf(62), "육십 아니 육십이입니다" to listOf(62), "구백구십구요" to listOf(999), "팔백으로 생각했다가 팔백오로 정했어" to listOf(805),
                "열일곱이면 돼" to listOf(17), "계산해 보니 영이네요" to listOf(0), "오백에서 하나 빼면 사백구십구네요" to listOf(499),
                "이백사십육으로 정했어요" to listOf(246), "삼십삼이 정답이야" to listOf(33), "칠이 아니라 팔이 맞는 것 같아" to listOf(8),
                "스물둘" to listOf(22), "천" to listOf(1000), "백오" to listOf(105), "오늘은 이번에 일곱" to listOf(7), "잘 모르겠어" to emptyList()))
            assertEquals(t, want, Brain.finalAnswer(t))
    }

    // 정답이 먼저 묻기(confirm=yes)인데 두뇌가 묻지 않고 바로 바꾸는 문장을 세어 파일로 남긴다(개발·평가 정답 전체)
    @Test fun confirmYesThatRunsAtOnce() {
        val files = listOf("/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/dev.jsonl",
            "/Users/lumos/GoodNight/ai-training-v5/data/round6-independent-1026/eval_candidate.jsonl").map(::File)
        assumeTrue(files.all { it.exists() })
        val res = JSONArray(); var total = 0; val generic = LinkedHashSet<String>()
        val ss = scenarios().filterKeys { !it.startsWith("대기") && it != "알람 울리는 중" }
        for (f in files) f.forEachLine { line ->
            val j = JSONObject(line); val out = j.getString("output")
            if ("confirm=yes" in out) {
                total++
                val hits = JSONArray()
                for ((name, s) in ss) {
                    val t = brain.handle(s, j.getString("utterance"), ok(out), out)
                    val ch = changed(s, t.state)
                    if (t.say == "그렇게 할까요?") generic += out
                    if (ch.isNotEmpty()) hits.put(JSONObject().put("state", name).put("changed", JSONArray(ch)).put("say", if (t.say.isNotEmpty()) t.say else t.state.after))
                }
                if (hits.length() > 0) res.put(JSONObject().put("utterance", j.getString("utterance")).put("output", out).put("action", j.optString("action")).put("hits", hits))
            }
        }
        File(dir, "confirm_yes_runs.json").writeText(res.toString(1))
        println("먼저 묻기 정답 $total, 묻지 않고 바뀌는 문장 ${res.length()}, 기본 질문으로 빠진 문장 ${generic.size} ${generic.take(5)}")
        assertEquals(0, res.length())
    }

    // 규격을 통과하는 모든 출력(학습·개발·평가 정답과 오답)을 모든 상황에 넣어 두뇌 오류가 있는지 본다
    @Test fun noOutputCrashesBrainInAnyState() {
        val files = listOf("/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/train.jsonl",
            "/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/dev.jsonl",
            "/Users/lumos/GoodNight/ai-training-v5/data/round6-independent-1026/eval_candidate.jsonl").map(::File)
        assumeTrue(files.all { it.exists() } && File(dir, "base.json").exists())
        val outs = LinkedHashSet<String>()
        for (f in files) f.forEachLine { outs += JSONObject(it).getString("output") }
        val rows = JSONArray(File(dir, "base.json").readText())
        for (i in 0 until rows.length()) if (spec.parse(Spec.upgrade(rows.getJSONObject(i).getString("pred"))) is Spec.Result.Ok) outs += rows.getJSONObject(i).getString("pred")
        val one = run(BedState(), listOf(alarmWeekday)).copy(lastAlarmId = null)
        val full = fullState()
        val ss = scenarios() + mapOf(
            "대기: 양" to wait(one, "알람 좀 늦춰", "<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=none, ampm=none, time=none, time_type=later, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>", "amount"),
            "대기: 전체 삭제" to wait(full, "알람 전부 지워", "<maum_1>(command=delete, target=all, target_ampm=none, target_days=none, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>", "delete"),
            "대기: 저장 확인" to wait(full, "독서로 저장해", "<maum_0>(command=set_default, purpose=read, confirm=no)<maum_end>", "save"),
        )
        val bad = LinkedHashMap<String, String>(); var n = 0
        for (o in outs) for ((name, s) in ss) {
            n++
            try { brain.handle(s, "시험", ok(o), o) } catch (e: Exception) { bad.putIfAbsent(name + " / " + o, e.toString()) }
        }
        val kinds = bad.entries.groupBy { it.key.substringBefore(" / ") + " " + it.value.take(60) }
        println("출력 ${outs.size}개 x 상황 ${ss.size}개 = $n, 두뇌 오류 ${bad.size}")
        for ((k, v) in kinds) println("  오류 $k : ${v.size}개, 예 ${v.first().key.substringAfter(" / ").take(90)}")
        assertEquals(0, bad.size)
    }
}
