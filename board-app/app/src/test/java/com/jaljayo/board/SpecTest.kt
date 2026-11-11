package com.jaljayo.board

import com.jaljayo.board.brain.Spec
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

// 앱의 규격 검사기가 파이썬 검사기(ai/spec/v09/check.py)와 같은 판단을 하는지, 학습·개발·평가 정답 전부로 확인한다
class SpecTest {
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val BOTH = "command=tell_angles, part=both"; private val NONE = "command=tell_angles, part=none"
    /** 11/10 규격(decisions-81)으로 옮긴 모양: tell_angles에 purpose=none, tell_alarms에 target_type=none, 각도 숫자(target)의 방향은 none */
    private fun to1110(o: String): String {
        var x = o.replace(BOTH, NONE)
        x = Regex("(command=tell_angles, part=\\w+)\\)").replace(x) { "${it.groupValues[1]}, purpose=none)" }
        x = Regex("(command=tell_alarms, date=[\\w+]+, days=[\\w+]+)\\)").replace(x) { "${it.groupValues[1]}, target_type=none)" }
        x = Regex("direction=(?:up|down|same|context_up), amount=(\\w+), amount_type=target").replace(x) { m ->
            val a = m.groupValues[1]
            if (a == "max" && "direction=same" in m.value) m.value
            else if (a == "max" && "direction=down" in m.value) "direction=none, amount=0, amount_type=target"
            else "direction=none, amount=$a, amount_type=target"
        }
        return x
    }

    @Test fun allGoldOutputsPass() {
        val files = listOf(
            "/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/train.jsonl",
            "/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/dev.jsonl",
            "/Users/lumos/GoodNight/ai-training-v5/data/round6-independent-1026/eval_candidate.jsonl",
        ).map(::File)
        assumeTrue(files.all { it.exists() })
        var n = 0
        val bad = mutableListOf<String>()
        for (f in files) f.forEachLine { line ->
            val out = Spec.upgrade(JSONObject(line).getString("output")); n++   // v0.8 정답은 보드처럼 v0.9로 옮겨 검사
            val r = spec.parse(out)
            if (r is Spec.Result.Bad) bad += "$out -> ${r.why}"
        }
        assertEquals("정답인데 앱 검사기가 거절한 출력: ${bad.take(5)}", 0, bad.size)
        assertEquals(16084, n)
    }

    // 9차(v0.9) 학습·보강 정답과 코덱스 평가 후보를 그대로 검사한다
    @Test fun v09GoldOutputsPass() {
        val d = "/Users/lumos/GoodNight/ai-training-v5/data/round9-merged-skip/"
        val files = listOf("train_round9_skip.jsonl", "supplement_round9_skip.jsonl", "supplement_skip_off_1103.jsonl", "eval_candidate_810.jsonl").map { File(d + it) }
        assumeTrue(files.all { it.exists() })
        var n = 0
        val bad = mutableListOf<String>()
        for (f in files) f.forEachLine { line ->
            val out = JSONObject(line).getString("output"); n++
            // 11/04: 저장값 초기화에 object 칸이 생겨 11/03 출력은 저장값(saved)으로 옮겨 읽는다. 그 밖의 11/03 출력은 옮길 것이 없다
            val up = Spec.upgrade(out)
            val r = spec.parse(up)
            if (r is Spec.Result.Bad) bad += "$out -> ${r.why}"
            if ("command=reset_default" in out) assertEquals(out.replace(", confirm=", ", to=factory, confirm="), up)
            else assertEquals("v0.9 출력은 11/10 꼴로만 옮김", to1110(out), up)   // 11/09 both → none, 11/10 칸 추가·각도 숫자 방향 none
        }
        assertEquals("정답인데 앱 검사기가 거절한 출력: ${bad.take(5)}", 0, bad.size)
        assertEquals(15168 + 896 + 40 + 810, n)
    }

    // 보드의 옮기기(Spec.upgrade)가 학습 자료 변환(convert_v09.py)과 한 줄도 다르지 않은지
    @Test fun upgradeMatchesPythonConverter() {
        val g = "/Users/lumos/GoodNight/ai-training-v5/data/"
        val pairs = listOf("round9-work-1103/train_round9_tv.jsonl" to "round9-merged-skip/train_round9_skip.jsonl",
            "round9-work-1103/supplement_round9.jsonl" to "round9-merged-skip/supplement_round9_skip.jsonl").map { File(g + it.first) to File(g + it.second) }
        assumeTrue(pairs.all { it.first.exists() && it.second.exists() })
        var changed = 0
        for ((a, b) in pairs) {
            val xs = a.readLines(); val ys = b.readLines()
            assertEquals(xs.size, ys.size)
            for (i in xs.indices) {
                val o8 = JSONObject(xs[i]).getString("output"); val o9 = JSONObject(ys[i]).getString("output")
                assertEquals(o8, Spec.upgrade(o9), Spec.upgrade(o8)); if (o8 != o9) changed++
            }
        }
        assertEquals(909 + 29, changed)
    }

    // 11/04 결정표를 반영한 학습(80종)은 보드 검사기를 그대로 통과하고, 옮길 것이 없어야 한다
    @Test fun round9bTrainPasses() = trainPasses("train_round9b_1104.jsonl")
    // 9c(난이도 앞으로 계속 보강 16·빼기 16)도 같다
    @Test fun round9cTrainPasses() = trainPasses("train_round9c_1104.jsonl")
    // 9d(표현 편중 보강으로 문장 196개를 바꿔 쓴 판). 정답은 9c와 같다
    @Test fun round9dTrainPasses() = trainPasses("train_round9d_1104.jsonl")
    // 9f(정답 8줄 수정과 문장 80개 바꿔 쓰기 뒤, 9차 학습에 쓰는 판)
    @Test fun round9fTrainPasses() = trainPasses("train_round9f_1104.jsonl")
    @Test fun round9gTrainPasses() = trainPasses("train_round9g_1105.jsonl")
    private fun trainPasses(name: String) {
        val f = File("/Users/lumos/GoodNight/ai-training-v5/data/round9-merged-skip/$name")
        assumeTrue(f.exists())
        val bad = mutableListOf<String>(); var n = 0
        f.forEachLine { line ->
            val out = JSONObject(line).getString("output"); n++
            // 11/09: 저장값 되돌리기의 object 칸은 to=factory로 옮겨 받는다. 그 밖의 출력은 그대로
            val up = Spec.upgrade(out); if ("command=reset_default" !in out) assertEquals(to1110(out), up)   // 11/09 both → none, 11/10 칸 추가·각도 숫자 방향 none
            val r = spec.parse(up); if (r is Spec.Result.Bad) bad += "$up -> ${r.why}"
        }
        assertEquals("거절한 출력: ${bad.take(5)}", 0, bad.size)
        assertEquals(16064, n)
    }

    @Test fun skipCombinationsFail() {
        val t = "<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=%s, start=%s, until=%s, period=%s, target_type=none, target_order=none, confirm=no)<maum_end>"
        for (a in listOf(listOf("today", "tomorrow", "none", "none"), listOf("none", "today", "none", "1"), listOf("none", "none", "today", "none"),
                listOf("none", "fri", "fri", "none"), listOf("none", "none", "fri", "3"))) assertTrue(a.toString(), spec.parse(t.format(*a.toTypedArray())) is Spec.Result.Bad)
        for (a in listOf(listOf("none", "none", "none", "none"), listOf("this_weekend", "none", "none", "none"), listOf("none", "tomorrow", "none", "3"),
                listOf("none", "none", "next_fri", "none"), listOf("none", "none", "none", "1"))) assertTrue(a.toString(), spec.parse(t.format(*a.toTypedArray())) is Spec.Result.Ok)
    }

    @Test fun brokenOutputsFail() {
        for (o in listOf(
            "<maum_0>(command=adjust, part=head)<maum_end>",                    // 값 빠짐
            "<maum_0>(command=call, purpose=kitchen, confirm=no)<maum_end>",    // 없는 값
            "<maum_0>(command=call, purpose=read, confirm=no)",                 // 끝 토큰 없음
            "<maum_9>(type=yes)<maum_end>",                                     // 없는 토큰
        )) assertTrue(o, spec.parse(o) is Spec.Result.Bad)
    }

    // 11/09 이도 님 "하나로 통일해": 지금 각도 묻기의 both는 없앴고, 옛 모델이 내는 both는 none으로 받는다
    @Test fun tellAnglesBothBecomesNone() {
        assertTrue(spec.parse("<maum_4>(command=tell_angles, part=both)<maum_end>") is Spec.Result.Bad)
        val up = Spec.upgrade("<maum_4>(command=tell_angles, part=both)<maum_end>")
        assertEquals("<maum_4>(command=tell_angles, part=none, purpose=none)<maum_end>", up)
        assertTrue(spec.parse(up) is Spec.Result.Ok)
    }
}
