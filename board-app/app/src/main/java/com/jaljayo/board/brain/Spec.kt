package com.jaljayo.board.brain

import org.json.JSONArray
import org.json.JSONObject

// 모델 출력 <maum_N>(이름=값, ...)<maum_end>를 읽고 규격(ai/spec/v09)에 맞는지 검사한다.
// 규격은 assets/spec_v09.json(tools/export_spec.py로 파이썬 규격에서 뽑은 파일)에서 읽는다. 검사 내용은 ai/spec/v09/check.py와 같다.
// v0.8 모델 출력의 skip·disable은 upgrade()로 v0.9 skip으로 옮긴 뒤 검사한다.
data class Command(val token: String, val command: String?, val kv: Map<String, String>) {
    operator fun get(name: String): String = kv[name] ?: "none"
}

class Spec(json: String) {
    private val end: String
    private val fields = HashMap<String, List<Pair<String, Any>>>()
    private val answers = HashMap<String, Any>()

    init {
        val o = JSONObject(json)
        end = o.getString("end")
        val spec = o.getJSONObject("spec")
        for (key in spec.keys()) {
            val arr = spec.getJSONArray(key)
            fields[key] = (0 until arr.length()).map { i ->
                val f = arr.getJSONArray(i)
                f.getString(0) to kind(f.get(1))
            }
        }
        val ans = o.getJSONObject("answers")
        for (key in ans.keys()) answers[key] = kind(ans.get(key))
    }

    private fun kind(v: Any): Any = if (v is JSONArray) (0 until v.length()).map { v.getString(it) } else v as String

    /** 형식이 맞으면 Command, 틀리면 오류 문장을 돌려준다 */
    fun parse(out: String): Result {
        val m = PAT.matchEntire(out) ?: return Result.Bad("토큰·끝 토큰 형식 불일치")
        if (!out.endsWith(end)) return Result.Bad("끝 토큰 없음")
        val tok = m.groupValues[1]; val body = m.groupValues[2]
        val kv = LinkedHashMap<String, String>()
        if (body.isNotEmpty()) for (p in body.split(", ")) {
            if (!PAIR.matches(p)) return Result.Bad("값 표기 오류: $p")
            val (k, v) = p.split("=", limit = 2)
            if (k in kv) return Result.Bad("값 이름 중복: $k")
            kv[k] = v
        }
        val cmd = kv.remove("command")
        val spec = fields["$tok|${cmd ?: ""}"] ?: return Result.Bad("정의되지 않은 토큰·명령: $tok $cmd")
        if (kv.keys.toList() != spec.map { it.first }) return Result.Bad("값 이름·순서 불일치")
        for ((n, k) in spec) if (!checkValue(k, kv.getValue(n), kv)) return Result.Bad("허용되지 않은 값: $n=${kv[n]}")
        crossCheck(cmd, kv)?.let { return Result.Bad(it) }
        return Result.Ok(Command(tok, cmd, kv))
    }

    private fun crossCheck(cmd: String?, kv: Map<String, String>): String? {
        val g = { k: String -> kv[k] ?: "none" }
        if ("amount" in kv && (g("amount") == "none") != (g("amount_type") == "none")) return "양과 양 종류가 어긋남"
        if (g("target_ampm") in setOf("dawn", "morning") && g("target") !in setOf("none", "all")) return "새벽·아침은 시각 없이 고를 때만"
        for ((n, a) in listOf("time" to "ampm", "target" to "target_ampm"))
            if (g(n) !in setOf("none", "all") && g(a) != "none" && g(n).take(2).toInt() !in 1..12) return "오전·오후와 시가 어긋남"
        val tt = kv["time_type"]
        if (tt != null) {
            if (g("time") != "none" && tt == "none") return "시각이 있는데 time_type이 none"
            if (g("time") == "none" && tt !in setOf("none", "earlier", "later", "keep")) return "시각이 없는데 absolute·relative"
            if (tt in setOf("relative", "earlier", "later") && g("ampm") != "none") return "걸리는 시간인데 ampm이 있음"
        }
        if (cmd == "change_reserve" && tt !in setOf("absolute", "none", "keep") && g("date") != "none") return "예약 변경 날짜 오류"
        if (g("until") != "none" && g("period") != "none") return "until과 period를 함께 씀"
        // 11/04: 알람 바꾸기 범위는 once·always·none(말하지 않음). 날짜만 있으면 none이고 보드가 묻는다(10/17 "날짜가 있으면 once"를 바꿈)
        if (kv["amount"] == "small" && kv["amount_type"] != "delta") return "조금은 delta"
        // 11/10 R4: 많이(large, 20도)는 delta. R3: 각도 숫자(target)의 방향은 none(계속 끝까지만 max·same)
        if (kv["amount"] == "large" && kv["amount_type"] != "delta") return "많이는 delta"
        if (cmd == "adjust" && kv["amount_type"] == "target" && kv["direction"] != "none" && !(kv["amount"] == "max" && kv["direction"] == "same")) return "각도 숫자의 방향은 none"
        if (kv["amount"] in setOf("0", "max") && kv["amount_type"] != "target") return "0도와 max는 target"
        if (tt in setOf("relative", "earlier", "later") && kv["time"] == "00:00") return "0시간은 허용하지 않음"
        if (tt == "relative" && g("date") != "none") return "relative에 날짜"
        if (kv["direction"] == "context_up" && !(kv["part"] in setOf("head", "leg") && kv["amount"] == "small" && kv["amount_type"] == "delta")) return "context_up 조건"
        if (kv["direction"] == "context_up" && kv["confirm"] != "yes") return "context_up은 동의 필요"
        if (tt == "keep" && (cmd != "change_reserve" || kv["time"] != "none" || kv["ampm"] != "none" || kv["date"] == "none")) return "keep 조건"
        if (g("target_order") != "none" && kv["target"] == "all") return "전체와 순번 동시 지정"
        if (kv["context"] == "required" && listOf("target", "target_ampm", "target_days", "target_type", "target_order", "date", "scope").any { g(it) != "none" }) return "맥락 전용 난이도에 대상 있음"
        if (cmd == "select_alarm") {
            if (kv["target"] == "all") return "전체 선택은 selection"
            if (kv.values.all { it == "none" }) return "대상 없는 select_alarm"
        }
        if (cmd == "request") {
            if (kv["operation"] !in setOf("delay", "advance") && kv["time"] != "none") return "기간은 delay/advance만"
            if (kv["operation"] != "skip" && kv["date"] != "none") return "날짜는 skip만"
        }
        if (cmd == "delay_active" && kv["time"] == "00:00") return "0분 미루기"
        // v0.9 skip(건너뛰기·기간 끄기 통합): 하루는 date 하나로만 쓴다
        if (cmd == "skip") {
            if (g("date") != "none" && listOf("start", "until", "period").any { g(it) != "none" }) return "하루와 기간을 함께 씀"
            if (g("start") != "none" && (g("period") == "1" || g("start") == g("until"))) return "이름 붙은 하루는 date로 씀"
            if (g("until") == "today" && g("start") in setOf("none", "today")) return "오늘 하루는 date=today로 씀"
            if (g("start") == "ask" && g("until") == "none" && g("period") == "none") return "시작일을 물을 때는 기간이 있어야 함"
        }
        return null
    }

    private fun isDate(v: String) = v == "today" || v == "tomorrow" || v in DAYS || (v.startsWith("next_") && v.drop(5) in DAYS) || v == "+2"
    private fun isTime(v: String) = v == "none" || v == "24:00" || (TIME.matches(v) && v.take(2).toInt() < 24 && v.takeLast(2).toInt() < 60)
    private fun daysN(v: String) = Regex("days_[1-9][0-9]*").matches(v)

    private fun checkValue(kind: Any, v: String, kv: Map<String, String>): Boolean {
        if (kind is List<*>) return v in kind
        return when (kind as String) {
            "time" -> isTime(v)
            "order" -> v == "none" || v == "last" || Regex("index_[1-9][0-9]*").matches(v)
            "skip_start" -> v == "ask" || checkValue("alarm_date", v, kv)
            "alarm_date", "alarm_skip_date" -> v == "none" || isDate(v) || (daysN(v) && v.drop(5).toInt() >= 3) || (kind == "alarm_skip_date" && v == "this_weekend")
            "target_angle" -> v == "none" || (v.all(Char::isDigit) && v.toInt() in 0..90)
            "angle" -> v in setOf("none", "max", "small", "large") || (v.all(Char::isDigit) && v.toInt() in 0..90)
            "set_angle" -> v.isNotEmpty() && v.all(Char::isDigit) && v.toInt() in 0..90
            "target" -> v == "none" || v == "all" || isTime(v)
            "period" -> v == "none" || (v.all(Char::isDigit) && v.toInt() in 1..60)
            "skip_date" -> v == "this_weekend" || v == "none" || isDate(v)
            "date" -> v == "none" || isDate(v)
            "days" -> {
                if (v in setOf("none", "daily", "weekdays", "weekend")) return true
                val ds = v.split("+")
                ds.all { it in DAYS } && ds.toSet().size == ds.size && ds == ds.sortedBy { ORDER.indexOf(it) }
            }
            "answer" -> {
                val allowed = answers[kv["type"]]
                when {
                    allowed is List<*> -> v in allowed
                    allowed == "answer_duration_days" && v.startsWith("days_") -> daysN(v) && v.drop(5).toInt() in 1..60
                    allowed == "answer_duration" || allowed == "answer_duration_days" -> v != "none" && v != "00:00" && isTime(v)
                    allowed == "answer_date" -> v != "none" && (isDate(v) || (daysN(v) && v.drop(5).toInt() >= 3))
                    allowed == "answer_order" -> v != "none" && (v == "last" || Regex("index_[1-9][0-9]*").matches(v))
                    allowed == "answer_number" -> v.all(Char::isDigit) && v.isNotEmpty() && v.toInt() in 0..999
                    allowed == "answer_time" -> {
                        val t = if (v.startsWith("am_") || v.startsWith("pm_")) v.substring(3) else v
                        isTime(t) && t != "none" && (t == v || t.take(2).toInt() in 1..12)
                    }
                    else -> false
                }
            }
            else -> false
        }
    }

    sealed class Result {
        data class Ok(val cmd: Command) : Result()
        data class Bad(val why: String) : Result()
    }

    companion object {
        private val OLD_SKIP = Regex("^<maum_1>\\(command=(skip|disable), (.*)\\)<maum_end>$")
        private val SKIP_ORDER = listOf("target", "target_ampm", "target_days", "date", "start", "until", "period", "target_type", "target_order", "confirm")

        /** v0.8 모델(7차·8차)이 낸 skip·disable 출력을 v0.9 skip으로 옮긴다. 이미 v0.9이거나 다른 출력이면 그대로 돌려준다.
         *  하루를 가리키는 기간(오늘까지, 시작일+하루, 시작일=끝날)은 date 하나로 맞춘다(ai 변환 convert_v09.py와 같음) */
        fun upgrade(out: String): String {
            // 11/04 이전 모델의 저장값 초기화에는 object 칸이 없다: 저장값을 말한 것(saved)으로 받는다
            OLD_RESET.matchEntire(out)?.let { return "<maum_0>(command=reset_default, purpose=${it.groupValues[1]}, to=factory, confirm=${it.groupValues[2]})<maum_end>" }
            // 11/04~11/09 모델의 object(saved/unclear) 칸은 처음 값으로 되돌리기다(11/09 object 갈림 없앰)
            OBJ_RESET.matchEntire(out)?.let { return "<maum_0>(command=reset_default, purpose=${it.groupValues[1]}, to=factory, confirm=${it.groupValues[2]})<maum_end>" }
            // 11/09 이전 모델의 지금 각도 묻기 part=both는 none과 같은 동작이라 none으로 받는다(11/09 이도 님 "하나로 통일해")
            // 11/10: tell_angles에 자세(purpose) 칸, tell_alarms에 종류(target_type) 칸을 더했다. 옛 꼴은 none을 붙여 받는다.
            // 13차가 낸 자세 각도 묻기(part=read 등, 옛 규격에서도 형식 오류)는 purpose로 옮긴다
            OLD_ANGLES.matchEntire(out)?.let {
                val p = it.groupValues[1]
                return when (p) {
                    "both" -> "<maum_4>(command=tell_angles, part=none, purpose=none)<maum_end>"
                    "head", "leg", "none" -> "<maum_4>(command=tell_angles, part=$p, purpose=none)<maum_end>"
                    "read", "tv", "rest", "sleep" -> "<maum_4>(command=tell_angles, part=none, purpose=$p)<maum_end>"
                    else -> out
                }
            }
            OLD_ALARMS.matchEntire(out)?.let { return "<maum_4>(command=tell_alarms, date=${it.groupValues[1]}, days=${it.groupValues[2]}, target_type=none)<maum_end>" }
            // 11/10 R3: 각도 숫자(target)는 방향 none. 옛 모델이 낸 up·down·same(숫자) 방향은 동작이 같아 none으로 받는다. 끝까지(max)는 올림이라 up도 none
            OLD_TARGET.matchEntire(out)?.let {
                val (part, dir, amount, rest) = it.destructured
                if (amount == "max" && dir == "same") return out
                if (amount == "max" && dir == "down") return "<maum_0>(command=adjust, part=$part, direction=none, amount=0, amount_type=target$rest)<maum_end>"
                return "<maum_0>(command=adjust, part=$part, direction=none, amount=$amount, amount_type=target$rest)<maum_end>"
            }
            val m = OLD_SKIP.matchEntire(out) ?: return out
            val kv = LinkedHashMap<String, String>()
            for (p in m.groupValues[2].split(", ")) { val i = p.indexOf('='); if (i < 0) return out; kv[p.substring(0, i)] = p.substring(i + 1) }
            if (m.groupValues[1] == "skip") {
                if ("start" in kv) return out
                kv["start"] = "none"; kv["until"] = "none"; kv["period"] = "none"
            } else {
                val s = kv["start"] ?: return out; val u = kv["until"] ?: return out; val p = kv["period"] ?: return out
                kv["date"] = "none"
                val one = when {
                    u == "today" && s in setOf("none", "today") && p == "none" -> "today"
                    s != "none" && p == "1" && u == "none" -> s
                    s != "none" && s == u && p == "none" -> s
                    else -> null
                }
                if (one != null) { kv["date"] = one; kv["start"] = "none"; kv["until"] = "none"; kv["period"] = "none" }
            }
            if (kv.size != SKIP_ORDER.size || SKIP_ORDER.any { it !in kv }) return out
            return "<maum_1>(command=skip, " + SKIP_ORDER.joinToString(", ") { "$it=${kv[it]}" } + ")<maum_end>"
        }

        private val OLD_RESET = Regex("<maum_0>\\(command=reset_default, purpose=(\\w+), confirm=(yes|no)\\)<maum_end>")
        private val OBJ_RESET = Regex("<maum_0>\\(command=reset_default, purpose=(\\w+), object=(?:saved|unclear), confirm=(yes|no)\\)<maum_end>")
        private val OLD_ANGLES = Regex("<maum_4>\\(command=tell_angles, part=(\\w+)\\)<maum_end>")
        private val OLD_ALARMS = Regex("<maum_4>\\(command=tell_alarms, date=([\\w+]+), days=([\\w+]+)\\)<maum_end>")
        private val OLD_TARGET = Regex("<maum_0>\\(command=adjust, part=(\\w+), direction=(up|down|same|context_up), amount=(\\w+), amount_type=target(.*)\\)<maum_end>")
        private val PAT = Regex("^<(maum_[0-4]|General_Conversation)>\\((.*)\\)<maum_end>$")
        private val PAIR = Regex("\\w+=[A-Za-z0-9_:+\\-]+")
        private val TIME = Regex("\\d\\d:\\d\\d")
        private val ORDER = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
        private val DAYS = ORDER.toSet()
    }
}
