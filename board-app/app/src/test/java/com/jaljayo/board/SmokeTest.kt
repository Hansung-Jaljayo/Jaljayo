package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Rules
import com.jaljayo.board.brain.Spec
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

// 개발·평가 정답 코드 1,620개를 두뇌에 모두 넣어, 81종 어디서도 오류가 나지 않는지 본다.
// 알람 2개와 자세 예약이 걸려 있고 TV 자세로 누워 있는 상태에서 시작한다
class SmokeTest {
    @Test fun everyGoldOutputRuns() {
        val files = listOf("/Users/lumos/Jaljayo/ai/data/datasets/v0.8-round7-1026/dev.jsonl",
            "/Users/lumos/GoodNight/ai-training-v5/data/round6-independent-1026/eval_candidate.jsonl").map(::File)
        assumeTrue(files.all { it.exists() })
        val spec = Spec(File("src/main/assets/spec_v09.json").readText())
        val brain = Brain { LocalDateTime.of(2026, 10, 27, 22, 0).atZone(KST).toInstant().toEpochMilli() }
        fun ok(out: String) = (spec.parse(Spec.upgrade(out)) as Spec.Result.Ok).cmd
        var s = BedState()
        for ((h, o) in listOf(
            "티비 자세" to "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>",
            "평일 일곱 시" to "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=weekdays, confirm=no)<maum_end>",
            "주말 여덟 시" to "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=question, repeat=weekly, days=weekend, confirm=no)<maum_end>",
            "열한 시 반 잠" to "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute, confirm=no)<maum_end>",
        )) s = brain.handle(s, h, ok(o), o).state.let { it.copy(angles = it.target) }
        val base = s
        val crash = mutableListOf<String>(); val notNow = HashMap<String, Int>(); var n = 0
        for (f in files) f.forEachLine { line ->
            val j = JSONObject(line); val out = j.getString("output"); n++
            try {
                val t = brain.handle(base, j.getString("utterance"), ok(out), out)
                if (t.say == Rules.NOT_NOW) notNow.merge(j.getString("action"), 1, Int::plus)
            } catch (e: Exception) { crash += "${j.getString("action")} $out -> $e" }
        }
        println("돌린 문장 $n, '지금은 할 수 없는 요청'으로 빠진 세부 기능: $notNow")
        assertEquals("오류: ${crash.take(5)}", 0, crash.size)
    }
}
