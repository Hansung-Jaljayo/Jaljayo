package com.jaljayo.board

import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.KST
import com.jaljayo.board.brain.Purpose
import com.jaljayo.board.brain.Spec
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

// 11/17 목소리 바꾸기: 학습 문장 77,250개의 정답 출력을 보드 두뇌에 넣어 보드가 실제로 하는 대답을 모두 모은다(미리 만들어 둘 문장 수 세기).
// 상황 두 가지(알람 없음 / 평일 7시·주말 8시 알람과 11시 반 잠 예약 있음)에서 돌리고, 문장의 "침대 움직이는 중"·"알람 울리는 중"도 맞춰 넣는다.
// [앞 질문]이 있는 문장은 그 질문을 만든 대기 상태를 되살리지 못해 대기 없이 넣는다(그 대답 일부는 빠질 수 있음).
// 결과: ~/aihub/work/replies/all_replies.tsv (대답 \t 나온 횟수)
class ReplyCountTest {
    private val data = File("../../ai/data/datasets/v0.9-round22/train.jsonl")
    private val spec = Spec(File("src/main/assets/spec_v09.json").readText())
    private val t0 = LocalDateTime.of(2026, 11, 16, 15, 0).atZone(KST).toInstant().toEpochMilli()
    private var nowMs = t0
    private val brain = Brain { nowMs }

    private fun cmd(out: String) = (spec.parse(Spec.upgrade(out)) as? Spec.Result.Ok)?.cmd
    private fun step(s: BedState, heard: String, out: String): Pair<BedState, String> {
        val t = brain.recordAsked(s, brain.handleSafely(s, heard, cmd(out)!!, out))
        return t.state.copy(angles = t.state.target, after = "") to t.say.ifEmpty { t.state.after }
    }

    private fun base(alarms: Boolean): BedState {
        nowMs = t0
        var s = step(BedState(), "티비 자세", "<maum_0>(command=call, purpose=tv, confirm=no)<maum_end>").first
        s = s.copy(memory = mapOf(Purpose.TV to s.target))
        if (alarms) {
            s = step(s, "평일 일곱 시", "<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=leave_bed, repeat=weekly, days=weekdays, confirm=no)<maum_end>").first
            s = step(s, "주말 여덟 시", "<maum_1>(command=set, date=none, ampm=am, time=08:00, time_type=absolute, type=question, repeat=weekly, days=weekend, confirm=no)<maum_end>").first
            s = step(s, "열한 시 반 잠", "<maum_0>(command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute, confirm=no)<maum_end>").first
        }
        nowMs = t0 + 60_000
        return s.copy(lastAlarmId = null, lastAlarmUntil = 0L)
    }

    @Test fun countReplies() {
        assumeTrue(data.exists())
        val bases = listOf(base(false), base(true))
        val seen = HashMap<String, Int>(); var rows = 0; var bad = 0
        data.forEachLine { line ->
            val d = JSONObject(line); rows++
            val out = d.getString("output"); val heard = d.getString("utterance")
            if (cmd(out) == null) { bad++; return@forEachLine }
            for (b0 in bases) {
                var s = b0
                when (d.optString("state")) {
                    "침대 움직이는 중" -> s = s.copy(moveStart = s.angles, target = s.target.copy(head = (s.target.head + 20).coerceAtMost(60.0)), after = "머리를 올렸어요")
                    "알람 울리는 중" -> if (s.alarms.isNotEmpty()) s = s.copy(ringing = s.alarms.first())
                }
                nowMs = t0 + 60_000
                val say = try { step(s, heard, out).second } catch (e: Exception) { "" }
                if (say.isNotBlank()) seen.merge(say.trim(), 1, Int::plus)
            }
        }
        val dir = File(System.getProperty("user.home"), "aihub/work/replies").apply { mkdirs() }
        File(dir, "all_replies.tsv").writeText(seen.entries.sortedByDescending { it.value }.joinToString("\n") { "${it.key}\t${it.value}" })
        println("문장 $rows 개, 읽지 못한 출력 $bad 개, 서로 다른 대답 ${seen.size} 개")
    }
}
