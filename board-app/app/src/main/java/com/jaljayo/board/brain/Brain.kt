package com.jaljayo.board.brain

import kotlin.math.abs
import kotlin.math.roundToInt

// 침대의 두뇌: 들은 말과 모델 출력을 받아 지금 상태를 보고 할 일과 할 말을 정한다.
// 규칙은 행동·대답 표 3판(데이터시트 "상황별 침대 동작")과 docs/system-design.md를 따른다.
// 움직임 대답은 움직이기 전에 말하지 않고 다 움직인 뒤 결과만 말한다(after). 바람·불평(confirm=yes)은 먼저 묻고 동의를 기다린다(pending).
// 이 파일은 안드로이드에 기대지 않아 맥에서 시험할 수 있다.

data class Angles(val head: Double, val leg: Double) {
    operator fun get(p: Part) = if (p == Part.HEAD) head else leg
    fun with(p: Part, v: Double) = if (p == Part.HEAD) copy(head = v) else copy(leg = v)
    fun same(o: Angles) = abs(head - o.head) < 0.5 && abs(leg - o.leg) < 0.5
}

enum class Part(val code: String, val ko: String) { HEAD("head", "머리"), LEG("leg", "다리") }

enum class Purpose(val code: String, val ko: String) {
    READ("read", "독서"), TV("tv", "TV"), REST("rest", "휴식"), SLEEP("sleep", "잠"), FLAT("flat", "평평하게");
    companion object { fun of(c: String) = entries.firstOrNull { it.code == c } }
}

data class Reservation(val atMs: Long, val label: String, val purpose: Purpose, val target: Angles, val angleOnly: Boolean = false) {
    /** 예약 내용을 말로: "휴식 자세", "평평하게 바꾸는", 폰에서 각도만 정한 예약은 "머리 30도, 다리 20도로 바꾸는" */
    fun desc(): String = when {
        angleOnly -> "머리 ${Math.round(target.head)}도, 다리 ${Math.round(target.leg)}도로 바꾸는"
        purpose == Purpose.FLAT -> "평평하게 바꾸는"
        else -> purpose.ko + " 자세"
    }
}
// alarms, angles: 물어본 그 대상. "응"을 들었을 때 그대로인지 확인하고 실행한다
// question: 그때 물은 질문(다시 물을 때 씀)
// asked: 이 물음을 시작하거나 다시 물을 때 실제로 소리 내어 말한 문장 그대로(모델 입력의 [앞 질문]에 씀). question은 다시 묻기용이라 형식이 다를 수 있다
// firstAngle: R3(11/04)에서 "처음으로 돌려"가 저장값인지 이동인지 갈리지 않아 묻는 중. 이동의 목적지(처음 각도)는 지원하지 않아 저장된 자세로 대신 옮기지 않는다
data class Pending(val kind: String, val output: String, val heard: String, val alarms: List<AlarmItem>? = null, val angles: Angles? = null, val question: String = "", val firstAngle: Boolean = false, val asked: String = "", val listed: Boolean = false)

data class BedState(
    val angles: Angles = Angles(0.0, 0.0),     // 지금 각도(시뮬레이션이 움직이며 바꿈)
    val target: Angles = Angles(0.0, 0.0),     // 가려는 각도
    val moveStart: Angles = Angles(0.0, 0.0),  // 이번 움직임을 시작한 각도
    val purpose: Purpose? = null,
    val lastPart: Part? = null,
    val lastDir: String? = null,
    val undo: Pair<Angles, Purpose?>? = null,
    val memory: Map<Purpose, Angles> = emptyMap(),
    val prevMemory: Map<Purpose, Angles?> = emptyMap(),   // 자세마다 바로 전에 저장돼 있던 값 하나(null=처음 값이었음). "직전 값으로 되돌려"에 씀(11/09)
    val reservation: Reservation? = null,
    val alarms: List<AlarmItem> = emptyList(),
    val ringing: AlarmItem? = null,           // 지금 울리는(또는 답을 기다리는) 알람
    val question: Pair<Int, Int>? = null,     // 덧셈 알람 문제
    val questionSaid: String = "",            // 덧셈 문제를 물을 때 실제로 말한 문장 그대로(모델 입력의 [앞 질문]에 씀)
    val snoozeAt: Long? = null,               // 미룬 알람이 다시 울릴 때
    val turnTarget: Angles? = null,           // 직전 말이 바꾼 침대 목표(11/04 R1: "하던 요청 취소"가 이 움직임을 가리키는지 볼 때 씀)
    val lastAlarmId: Int? = null,             // 방금 이야기한 알람(그거·그 알람). 미룬 알람을 다시 울릴 때도 씀
    val lastAlarmUntil: Long = 0L,            // 이 시각(ms)까지만 "이 알람"·대상 없는 말의 대상으로 씀(알람 얘기를 끝낸 뒤 10초)
    val lastCalled: Purpose? = null,          // 마지막으로 불러온 저장 자세(원래대로 = saved)
    val lastMoveWasTarget: Boolean = false,   // 바로 앞 이동이 목표 이동(각도 지정·자세 부르기)인지
    val timeValid: Boolean = true,            // 시각을 PC·폰에서 받았는지(보드 시계는 틀릴 수 있음)
    val pending: Pending? = null,
    val after: String = "",      // 다 움직이면 할 말
    val lastSpeech: String = "", // 직전에 한 말(다시 듣기용)
    val listed: List<Int> = emptyList(),      // 11/11: 방금 읽어 준 알람 목록(id). "세 개 다 지워"가 이 목록을 가리킴
    val listedUntil: Long = 0L,               // 이 시각(ms)까지만 위 목록을 씀
) {
    val moving get() = !angles.same(target)
}

/** 한 번 처리한 결과: 다음 상태, 지금 바로 할 말, 화면에만 보이는 설명 */
data class Turn(val state: BedState, val say: String = "", val note: String = "")

object Rules {
    val LIMIT = Angles(60.0, 40.0)
    val DEFAULTS = mapOf(
        Purpose.READ to Angles(45.0, 15.0), Purpose.TV to Angles(30.0, 10.0), Purpose.REST to Angles(15.0, 20.0),
        Purpose.SLEEP to Angles(0.0, 0.0), Purpose.FLAT to Angles(0.0, 0.0),
    )
    const val SMALL = 5.0         // "조금"·"덜"
    const val LARGE = 20.0        // "많이"·"확"(11/10 R4)
    const val DEFAULT_STEP = 10.0 // 양 말 없는 조절. 올릴 때와 내릴 때 모두(11/10 R4, 전에는 내릴 때 끝까지)
    const val NOT_NOW = "지금은 할 수 없는 요청이에요"
    const val WHAT = "무엇을 할까요? '머리 올려'나 '알람 꺼'처럼 말씀해 주세요"
    const val EXACT = "정확한 시각을 다시 말씀해 주세요."
    const val MISHEARD = "잘 못 알아들었거나 제가 할 수 없는 일이에요. 다시 말씀해 주시겠어요?"
    const val CHAT = "필요하신 게 있으면 '머리 올려 줘', '알람 맞춰 줘'처럼 말씀해 주세요"  // 11/10 R8
    const val MUST_SOLVE = "문제를 풀어야 꺼져요"  // 11/10: 덧셈 알람 문제를 묻는 중 끄라는 말
    // 쓰는 시각은 12시간제 고유어(한 시부터 열두 시)와 24시간제(공공·영·공일부터 공구·십부터 이십사 시)뿐(11/03 결정).
    // 그 밖의 한자어 시각("구 시", "팔 시", "공이 시")은 시각으로 쓰지 않고 다시 묻는다. "일시정지", "이 시간", "이 시점"은 시각이 아니다
    // 문장에서 "숫자 말 전체 + 시"를 찾아(스물다섯·서른두·공두처럼 앞부분을 버리지 않음) 그 말 전체를 목록과 대조한다.
    // "시" 뒤에 시간·시각·시점·시설·시작처럼 다른 낱말이 붙거나 "일시 정지"면 시각이 아니다
    // 숫자 말 왼쪽 경계: 낱말 시작, 또는 날짜·시간대 말(+조사) 바로 뒤에 붙여 쓴 경우("내일은구 시", "오전에는구 시", "매주아홉 시")
    private val LEFT_WORDS = listOf("오전", "오후", "아침", "저녁", "새벽", "낮", "밤", "평일", "주말", "매일", "매주", "내일", "오늘", "모레", "요일", "낼")
    private val LEFT_TAILS = listOf("", "은", "는", "에", "에는", "엔", "도", "에도")
    private val LEFT = "(?:(?<![가-힣])" + LEFT_WORDS.flatMap { w -> LEFT_TAILS.map { "|(?<=$w$it)" } }.joinToString("") + ")"
    private const val NUM = "(공[공영일이두삼사오육칠팔구]|(?:스물|서른|마흔|쉰|예순)(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉)?|스무|열한|열두|열|다섯|여섯|일곱|여덟|아홉|한|두|세|네|[영일이삼사오육칠팔구십백천]+)"
    val HOUR_WORD = Regex(LEFT + NUM + "\\s*시(?![간각점설리작절기험즌선대장민청계골트키내외합동공원상비국])(?!\\s*정지)(?!\\s*세끼)")
    val OK_HOURS = setOf("한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두",
        "공공", "영", "공일", "공두", "공삼", "공사", "공오", "공육", "공칠", "공팔", "공구", "십", "십일", "십이", "십삼", "십사", "십오", "십육",
        "십칠", "십팔", "십구", "이십", "이십일", "이십이", "이십삼", "이십사")
    /** 문장 속 시각 말 가운데 목록에 없는 것(구 시·팔 시·스물두 시·스물다섯 시·이십오 시 등) */
    fun badHours(heard: String): List<String> = HOUR_WORD.findAll(heard).map { it.groupValues[1] }.filter { it !in OK_HOURS }.toList()
    // 기다리는 대답이 아닌 말이 오면 무엇을 말해야 하는지 먼저 알려 주고 직전 질문을 다시 한다(11/02 결정)
    val NEED = mapOf("set_time" to "시각을 말씀해 주세요.", "amount" to "시간을 말씀해 주세요.", "part" to "머리나 다리를 말씀해 주세요.",
        "ampm" to "오전인지 오후인지 말씀해 주세요.", "alarm" to "어떤 알람인지 말씀해 주세요.",
        "confirm" to "네 또는 아니요로 말씀해 주세요.", "delete" to "네 또는 아니요로 말씀해 주세요.",
        "save" to "네 또는 아니요로 말씀해 주세요.", "reset" to "네 또는 아니요로 말씀해 주세요.", "reset_purpose" to "자세 이름을 말씀해 주세요.", "purpose" to "자세 이름을 말씀해 주세요.",
        "alarm_type" to "알람 종류를 말씀해 주세요.", "level" to "한 자리나 두 자리로 말씀해 주세요.")
    const val NO_RESERVATION = "걸려 있는 자세 예약이 없어요"
    // 모델을 거치지 않는 단독 정지 말(설계서 6절). "타임"은 움직이는 중에만 멈춤
    val STOP_WORDS = setOf("멈춰", "그만", "스톱", "스탑", "올스톱", "얼음", "가만히 있어봐", "가만히 있어 봐", "멈춰 줘", "멈춰줘", "정지")
}

class Brain(private val clock: () -> Long) {

    fun clamp(v: Double, p: Part) = v.coerceIn(0.0, Rules.LIMIT[p])

    /** 이번 턴에 말할 문장이 새로 묻기 시작했거나 다시 물은 질문이면 그 문장을 그대로 상태에 적어 둔다.
     *  보드 앱은 말하기 직전에 이것을 거친 상태를 쓴다. prev는 이 턴 앞의 상태 */
    fun recordAsked(prev: BedState, t: Turn): Turn {
        var ns = t.state
        val np = ns.pending
        // 새 물음(새로 만들었거나 다시 물으며 새로 담은 것)이고 말한 문장이 있으면 그 문장이 기다리는 질문이다
        if (np != null && np !== prev.pending && t.say.isNotEmpty()) ns = ns.copy(pending = np.copy(asked = t.say))
        ns = when {
            ns.ringing == null || ns.question == null -> if (ns.questionSaid.isEmpty()) ns else ns.copy(questionSaid = "")
            t.say.endsWith("더하기 ${sino(ns.question.second)}는 얼마예요?") -> ns.copy(questionSaid = t.say)
            else -> ns
        }
        return if (ns === t.state) t else t.copy(state = ns)
    }

    /** 지금 대답을 기다리는 질문 문장(실제로 말한 그대로). 기다리는 질문이 없으면 null */
    fun waitingQuestion(s: BedState): String? {
        s.pending?.asked?.takeIf { it.isNotEmpty() }?.let { return it }
        val q = s.question
        if (s.ringing != null && q != null) return s.questionSaid.ifEmpty { "${sino(q.first)} 더하기 ${sino(q.second)}는 얼마예요?" }
        return null
    }

    /** 모델 입력의 [상태] 값. 알람이 울리는 중(덧셈 문제를 묻는 중 포함)이 먼저, 그다음 침대가 움직이는 중, 둘 다 아니면 "없음" */
    fun status(s: BedState): String = when {
        s.ringing != null -> STATUS_RINGING
        s.moving -> STATUS_MOVING
        else -> STATUS_NONE
    }

    /** 단독 정지 말이면 모델을 기다리지 않고 바로 멈춘다. 처리했으면 Turn, 아니면 null */
    fun quickStop(s: BedState, text: String): Turn? {
        val t = text.removePrefix("야 ").trim()
        // 11/10 이도 님 결정: 움직이는 중의 "잠깐만"도 "타임"처럼 바로 멈춘다
        val stop = t in Rules.STOP_WORDS || (t in setOf("타임", "잠깐만", "잠깐", "잠깐만요") && s.moving)
        if (!stop) return null
        if (s.moving) return stopNow(s, "정지 말을 듣고 모델을 거치지 않고 멈췄어요.")
        if (s.pending != null) return Turn(s.copy(pending = null), note = "물어보던 것을 접었어요.")
        return Turn(s, note = "움직이는 중이 아니라서 할 일이 없어요.")
    }

    fun stopNow(s: BedState, note: String): Turn {
        val a = Angles(s.angles.head.roundToInt().toDouble(), s.angles.leg.roundToInt().toDouble())
        val moved = Part.entries.filter { s.moveStart[it].roundToInt() != a[it].roundToInt() }
        val say = when (moved.size) {
            1 -> { val p = moved[0]; "${p.ko}를 ${a[p].roundToInt()}도까지 ${if (a[p] > s.moveStart[p]) "올리고" else "내리고"} 멈췄어요" }
            2 -> "머리 ${a.head.roundToInt()}도, 다리 ${a.leg.roundToInt()}도에서 멈췄어요"
            else -> "멈췄어요"
        }
        return Turn(s.copy(target = s.angles, after = "", pending = null), say = say, note = note)
    }

    private fun moveTo(s: BedState, target: Angles, purpose: Purpose?, after: String, targetMove: Boolean = false): Turn {
        if (target.same(s.target)) return Turn(s.copy(purpose = purpose, pending = null), say = after)
        return Turn(
            s.copy(undo = s.target to s.purpose, moveStart = s.angles, target = target, purpose = purpose, after = after, pending = null, lastMoveWasTarget = targetMove),
            note = "움직이는 중이에요. 다 움직인 뒤 결과를 말해요.",
        )
    }

    private fun remember(t: Turn): Turn {
        val p = t.state.purpose ?: return t
        if (p == Purpose.FLAT) return t
        return t.copy(state = t.state.copy(memory = t.state.memory + (p to t.state.target)))
    }

    // "~했어요"로 끝나는 결과 문장을 "~할까요?"로 바꿔 먼저 묻는다
    private val ask = listOf("맞췄어요" to "맞출까요?", "올렸어요" to "올릴까요?", "내렸어요" to "내릴까요?", "바꿨어요" to "바꿀까요?",
        "예약했어요" to "예약할까요?", "돌아갔어요" to "돌아갈까요?", "취소했어요" to "취소할까요?", "저장했어요" to "저장할까요?",
        "되돌렸어요" to "되돌릴까요?", "켰어요" to "켤까요?", "꺼 뒀어요" to "꺼 둘까요?", "삭제했어요" to "삭제할까요?",
        "늦췄어요" to "늦출까요?", "당겼어요" to "당길까요?", "건너뛰었어요" to "건너뛸까요?")
    private fun toQuestion(r: String): String {
        if (r.endsWith("울리지 않아요")) return "이번만 건너뛸까요?"
        val first = r.substringBefore(". ")  // "꺼 뒀어요. 내일부터 다시 울려요"처럼 덧붙인 안내는 묻는 말에서 뺀다
        for ((a, b) in ask) if (first.endsWith(a)) return first.dropLast(a.length) + b
        return r
    }

    /** 처리 중 오류가 나도 상태를 바꾸지 않는다. 묻던 것이 있으면 무엇을 말해야 하는지와 직전 질문을, 없으면 다시 말해 달라고 한다 */
    fun handleSafely(s: BedState, heard: String, c: Command, raw: String): Turn =
        try { handle(s, heard, c, raw) } catch (e: Exception) {
            (reask(s, heard) ?: Turn(s, say = "다시 한 번 말씀해 주세요")).copy(note = "처리 중 오류라 아무것도 바꾸지 않았어요: $e")
        }

    fun badHour(heard: String) = Rules.badHours(heard).isNotEmpty()

    /** 묻는 중에 기다리는 대답이 오지 않았을 때: 상태는 그대로 두고 "무엇을 말씀해 주세요." + 직전 질문. 묻던 것이 없으면 null */
    fun reask(s: BedState, heard: String): Turn? {
        val p = s.pending ?: return null
        val head = if (badHour(heard)) Rules.EXACT else Rules.NEED[p.kind] ?: return null
        var q = p.question
        if (q.isEmpty() && p.kind in setOf("set_time", "amount", "alarm")) q = handle(s.copy(pending = null), p.heard, parseKv(p.output), p.output).say
        for (h in Rules.NEED.values.toSet() + Rules.EXACT) q = q.removePrefix("$h ").removePrefix(h)
        if (p.kind == "part") q = "어느 쪽을 맞출까요?"
        // 새 물음으로 다시 10초를 기다리도록 묻던 것을 새로 담는다(내용은 같음)
        return Turn(s.copy(pending = p.copy()), say = listOf(head, q.trim()).filter { it.isNotEmpty() }.joinToString(" "))
    }

    /** 들은 말과 모델 출력(검사를 통과한 명령)으로 다음 상태를 만든다.
     *  들은 말에 쓰지 않는 한자어 시각이 있어 시각을 비운 채 되묻게 되면 "정확한 시각을 다시 말씀해 주세요."를 앞에 붙인다 */
    private var depth = 0
    fun handle(s0: BedState, heard: String, c0: Command, raw0: String): Turn {
        depth++
        try { return handleTop(s0, heard, c0, raw0, depth == 1) } finally { depth-- }
    }

    private fun handleTop(s0: BedState, heard: String, c0: Command, raw0: String, top: Boolean): Turn {
        // 11/11: 지금 상태만 말한 불평("다리가 좀 낮아")은 명령이 아니므로, 모델이 바로 실행(confirm=no)으로 내도 먼저 묻는다.
        // 움직이라는 말(올려 줘, 낮춰, 해 줘 등)이 함께 있으면 그대로 둔다
        val guard = top && c0.token == "maum_0" && c0.command == "adjust" && c0["confirm"] == "no" && complaintOnly(heard)
        val c = if (guard) c0.copy(kv = c0.kv + ("confirm" to "yes")) else c0
        val raw = if (guard) setField(raw0, "confirm", "yes") else raw0
        var t = handleInner(s0, heard, c, raw)
        if (guard) t = t.copy(note = listOf(t.note, "지금 상태만 말한 불평이라 바로 움직이지 않고 먼저 물었어요.").filter { it.isNotEmpty() }.joinToString(" "))
        if (t.state.memory != s0.memory) {
            val changed = (s0.memory.keys + t.state.memory.keys).filter { s0.memory[it] != t.state.memory[it] }
            t = t.copy(state = t.state.copy(prevMemory = t.state.prevMemory + changed.associateWith { s0.memory[it] }))
        }
        // R1(11/04): 이 말이 침대 목표를 바꿨으면 그 목표를 기억하고, 바꾸지 않은 말이면 연결을 끊는다
        t = t.copy(state = t.state.copy(turnTarget = if (t.state.target != s0.target) t.state.target else null))
        // 알람을 다루거나 고르거나 알람이 막 끝난 턴이면, 그 알람을 10초 동안만 "이 알람"으로 받아 준다(말이 끝나면 보드가 다시 10초로 맞춤)
        val ns = t.state
        if (ns.lastAlarmId != null && (c.token == "maum_1" || c.command in setOf("select_alarm", "request") || ns.lastAlarmId != s0.lastAlarmId || (s0.ringing != null && ns.ringing == null)))
            t = t.copy(state = ns.copy(lastAlarmUntil = clock() + RECENT_MS))
        if (badHour(heard) && t.state.pending != null && t.say.endsWith("?") && !t.say.startsWith(Rules.EXACT)) t = t.copy(say = "${Rules.EXACT} ${t.say}")
        // 새로 묻기 시작한 질문을 묻던 것에 함께 담는다(다시 물을 때 그 사이에 한 다른 말을 쓰지 않으려고)
        val np = t.state.pending
        if (np != null && np.question.isEmpty() && t.say.isNotEmpty()) {
            var q = t.say
            for (h in Rules.NEED.values.toSet() + Rules.EXACT) q = q.removePrefix("$h ")
            t = t.copy(state = t.state.copy(pending = np.copy(question = q)))
        }
        return t
    }

    private fun complaintOnly(heard: String): Boolean {
        val h = heard.trim()
        return COMPLAINT_END.containsMatchIn(h) && !MOVE_VERB.containsMatchIn(h)
    }

    /** 방금 이야기한 알람. 알람 얘기를 끝낸 지 10초가 지났으면 없음(오래전에 다룬 알람을 묻지 않고 고르지 않으려고) */
    private fun recent(s: BedState): AlarmItem? = if (clock() <= s.lastAlarmUntil) s.alarms.firstOrNull { it.id == s.lastAlarmId } else null

    private val VERB = mapOf("change_time" to "바꿀까요", "change_type" to "바꿀까요", "change_level" to "바꿀까요", "skip" to "건너뛸까요",
        "off" to "끌까요", "delete" to "삭제할까요", "enable" to "켤까요")

    /** 날짜 전체 건너뛰기(대상 없음)를 묻는 중인지 */
    private fun askingSkipAll(p: Pending?): Boolean {
        if (p?.kind != "confirm") return false
        val k = parseKv(p.output)
        return k.command == "skip" && k["target"] in setOf("none", "all") && listOf("target_ampm", "target_days", "target_type", "target_order").all { k[it] == "none" }
    }

    // 몸에 닿거나 남는 것. 먼저 묻기는 이것이 바뀌는 일에만 묻는다
    private fun effect(s: BedState) = listOf(s.target, s.alarms, s.reservation, s.memory, s.ringing, s.question, s.snoozeAt)

    /** 종류·난이도를 묻는 중 온 명령이 다른 알람(시각·오전오후·요일·순서·날짜·범위, 묻던 것과 다른 종류)을 가리키는지 */
    private fun newTarget(c: Command, p: Pending): Boolean {
        val k = parseKv(p.output)
        if (listOf("target", "target_ampm", "target_days", "target_order", "date", "scope").any { c[it] != "none" }) return true
        val t = c["target_type"]
        return t != "none" && t != k["target_type"] && !(c.command == "change_level" && t == "question")
    }

    private fun handleInner(s0: BedState, heard: String, c: Command, raw: String): Turn {
        val s = s0
        // 바람·불평: 같은 일을 바로 실행했을 때의 결과 문장을 질문으로 바꿔 먼저 묻는다. "응"을 들으면 그 일을 한다
        // 시각을 받기 전에는 알람·예약·시각 묻기를 하지 않는다(설계 509)
        val needsClock = c.token == "maum_1" || c.command in setOf("reserve", "change_reserve", "reserve_undo", "tell_time", "tell_alarms")
        if (!s.timeValid && needsClock) return Turn(s, say = "시계를 맞추려면 스마트폰 잘자요 앱과 한 번 연결해 주세요")
        // 알람 진행 중(답을 기다리는 중 포함)에는 덧셈 답과 미루기만 받는다(설계 329)
        // 알람이 울리는 중 대상 없이 "알람 십오 분 미뤄"(change_time later)라고 하면 울리는 이번 회차를 미룬다(11/04 경계 점검, 정책 추가).
        // 울리는 중에는 먼저 묻기(confirm=yes)도 묻지 않고 바로 미루는 기존 예외(지금 울린 알람 미루기와 같은 규칙)를 그대로 따른다.
        // 대상·날짜를 말했거나, "앞으로·계속·매일·매번·항상"처럼 알람 시각 자체를 옮기는 말이면 이번 회차 미루기가 아니므로 지금처럼 받지 않는다
        if (s.ringing != null && c.token == "maum_1" && c.command == "change_time" && c["time_type"] == "later" &&
            listOf("target", "target_ampm", "target_days", "date", "target_type", "target_order").all { c[it] == "none" } &&
            !Regex("앞으로|계속|매일|매번|항상|쭉").containsMatchIn(heard)) {
            return alarm(s, heard, Command("maum_1", "delay_active", mapOf("time" to c["time"], "confirm" to "no")), raw)
        }
        // 알람이 울리는 중 대상 없는 미루기("삼십 분만 뒤로 미뤄", request delay)는 울리는 이번 회차를 미룬다(11/04 B6, 새 정책).
        // 울리는 중에는 다른 대기 질문이 없다(알람이 울리기 시작할 때 묻던 것을 접음). 예약을 미루려면 "예약"을 말해 예약 명령으로 온다.
        // "앞으로·계속·매일"처럼 알람 시각 자체를 옮기는 말이면 B1과 같이 이번 회차 미루기로 바꾸지 않는다
        if (s.ringing != null && c.token == "maum_2" && c.command == "request" && c["operation"] == "delay" &&
            c["target"] == "none" && c["date"] == "none" && c["target_order"] == "none" &&
            !Regex("앞으로|계속|매일|매번|항상|쭉").containsMatchIn(heard)) {
            return alarm(s, heard, Command("maum_1", "delay_active", mapOf("time" to c["time"], "confirm" to "no")), raw)
        }
        // R2(11/04): 울리는 중 기간만 말한 대답("오분만", "십 분 더")은 울리는 알람 미루기로 받는다(최대 30분 규칙은 미루기와 같음)
        if (s.ringing != null && c.token == "maum_2" && c["type"] in setOf("duration", "relative_time") && Regex("\\d\\d:\\d\\d").matches(c["value"]))
            return alarm(s, heard, Command("maum_1", "delay_active", mapOf("time" to c["value"], "confirm" to "no")), raw)
        if (s.ringing != null) {
            val allowed = c.command == "delay_active" || (c.command == "set" && c["time_type"] == "relative") || (c.token == "maum_2" && c["type"] in setOf("number", "reference", "cancel"))
            // 11/10 이도 님 결정: 덧셈 문제를 묻는 중 끄라는 말 등은 "문제를 풀어야 꺼져요"라고 하고 문제를 다시 읽는다
            val q = s.question
            if (!allowed && s.ringing.type == "question" && q != null) return Turn(s, say = "${Rules.MUST_SOLVE}. ${Brain.sino(q.first)} 더하기 ${Brain.sino(q.second)}는 얼마예요?")
            if (!allowed) return Turn(s, say = Rules.NOT_NOW)
        }
        // 알람이 울리는 중에는 미루기를 돌려 말해도 묻지 않고 바로 미룬다(최대 30분, 말이 없으면 5분)
        if (s.ringing != null && (c.command == "delay_active" || (c.command == "set" && c["time_type"] == "relative"))) {
            val m = if (c["time"] == "none") "none" else c["time"]
            return alarm(s, heard, Command("maum_1", "delay_active", mapOf("time" to m, "confirm" to "no")), raw)
        }
        // 날짜 전체 건너뛰기를 묻는 중 "오전만 꺼 줘"·"오전만 건너뛰어 줘": 새 명령으로 실행하지 않고, 묻던 날짜에서 대상만 좁혀 다시 묻는다
        val p0 = s.pending
        if (askingSkipAll(p0) && c.token == "maum_1" && c.command in setOf("skip", "off") && c["target_ampm"] != "none" &&
            listOf("target", "target_days", "target_type", "target_order").all { c[it] == "none" } &&
            (c["date"] == "none" || c["date"] == parseKv(p0!!.output)["date"])) {
            return rerun(s, heard, setField(setField(p0!!.output, "target_ampm", c["target_ampm"]), "confirm", "yes"))
        }
        // 자세 이름을 묻는 중("어느 자세로 저장할까요?"·"어떤 자세를 기본 각도로 되돌릴까요?") 자세 부르기(call)가 오면(11/04 경계 점검 B4)
        // 낱말이 있는지가 아니라 어떤 행동을 부정했고 어떤 행동이 남았는지로 가른다
        // - 옮기기를 부정("옮겨 주지는 말고 독서로 해 주세요"): 묻던 질문에 이름만 채운다
        // - 하던 일을 부정하고 옮기기가 남음("저장 말고 독서 자세로 가 줘"): 새 명령으로 그 자세로 옮긴다
        // - 아무 행동도 말하지 않음("독서로 해 주세요"·"독서요"): 이름만 채운다
        // - 그 밖(옮기기만 말함, 하던 일만 부정함): 저장도 이동도 하지 않고 어느 쪽인지 묻는다
        // 이름을 채운 뒤에도 저장·되돌리기는 "독서 자세로 저장할까요?"처럼 한 번 더 묻고 대답 전에는 바꾸지 않는다
        if (p0 != null && p0.kind in setOf("purpose", "reset_purpose") && c.token == "maum_0" && c.command == "call" &&
            Purpose.of(c["purpose"]) != null && Purpose.of(c["purpose"]) != Purpose.FLAT && "purpose=none" in p0.output && "command=call" !in p0.output) {
            val filled = p0.output.replace("purpose=none", "purpose=${c["purpose"]}")
            val moveAsk = MOVE_ASK.containsMatchIn(MOVE_NEG.replace(heard, " "))  // 부정한 옮기기("옮겨 주지는 말고")를 지운 뒤 남은 옮기기 요청
            val taskNeg = TASK_NEG.containsMatchIn(heard)
            return when {
                taskNeg && moveAsk -> rerun(s, heard, raw)
                !moveAsk && !taskNeg -> rerun(s, heard, filled)
                else -> {
                    val name = Purpose.of(c["purpose"])!!.ko
                    val what = if (p0.kind == "purpose") "$name 자세로 저장할까요" else "$name 자세 저장 각도를 처음으로 되돌릴까요"
                    val q = "$what, 지금 침대를 $name 자세로 옮길까요?"
                    Turn(s.copy(pending = Pending("save_or_move", filled, heard, question = raw)), say = q)
                }
            }
        }
        // 저장(되돌리기)과 이동 중 어느 쪽인지 묻는 중(11/04 B4, 코덱스 5차 검토 반영). 이 질문에만 적용한다
        // 실행은 새 모델 출력·대화 문맥·안전 검사를 함께 본다. 이전 작업 종류나 확인 여부는 새 요청 대신 쓰지 않는다
        // - 지원 밖·앱 전용 등은 질문을 접고 원래 안내로, 망설임(wait)은 질문을 둔 채 기다린다
        // - 모델이 그만두기("아니"·"그만하자"·"그대로 둬")로 판정하면 앞에 옮기라는 말이 있어도 그만둔다(움직이는 중이면 멈춤 처리로)
        // - 옮기기: 새 출력이 자세 부르기(call)이고 원문에 옮기라는 요청이 남았을 때만, 새 출력(자세·확인 여부) 그대로
        // - 저장·되돌리기: 새 출력이 그 명령일 때만, 새 출력의 작업 종류·확인 여부 그대로. 자세 이름을 생략하면 방금 물은 한 자세만 이어받는다
        // - 원문에 그 작업을 부정하거나 철회하는 말, 또는 대상이 풀리지 않은 부정이 있으면 실행하지 않고 다시 묻는다(임시 방어)
        //   "독서 말고 잠 자세로 옮겨 줘"처럼 다른 자세·다른 작업을 부정한 정정은 막지 않는다
        // - 그 밖("응", 이름만, 바람 말투가 unclear로 나옴 등)은 아무것도 하지 않고 다시 묻는다
        if (p0 != null && p0.kind == "save_or_move") {
            val offered = parseKv(p0.question)["purpose"]
            val offeredOk = Purpose.of(offered ?: "").let { it != null && it != Purpose.FLAT }  // 이어받을 자세가 실제 자세 값일 때만
            val isReset = "reset_default" in p0.output
            fun reask(name: String?): Turn {
                val n = name ?: offered; val ko = Purpose.of(n)?.ko ?: ""
                val upd = if (name != null) p0.copy(output = setField(p0.output, "purpose", name), question = setField(p0.question, "purpose", name)) else p0
                if (p0.firstAngle) return Turn(s.copy(pending = upd), say = "${if (ko.isEmpty()) "자세" else "$ko 자세"} 저장 각도를 처음 값으로 되돌릴지, 지금 침대를 움직일지 말씀해 주세요")
                return Turn(s.copy(pending = upd), say = "$ko 자세로 ${if (isReset) "저장 각도를 되돌릴지" else "저장할지"}, 지금 침대를 $ko 자세로 옮길지 말씀해 주세요")
            }
            if (c.token == "maum_3" && c["reason"] != "unclear") return rerun(s, heard, raw)
            if (c.token == "maum_2" && c["type"] == "wait") return Turn(s, note = "망설이는 말이라 질문을 둔 채 기다려요.")
            if (c.token == "maum_2" && c["type"] in setOf("no", "cancel", "reference") ||
                (MOVE_NEG.containsMatchIn(heard) && SAVE_NEG.containsMatchIn(heard) && !(c.token == "maum_0" && c.command in setOf("call", "set_default", "reset_default"))))
                return if (s.moving) rerun(s, heard, raw) else Turn(s.copy(pending = null), say = "그만둘게요")
            val related = (c.token == "maum_0" && c.command in setOf("call", "set_default", "reset_default")) ||
                (c.token == "maum_2" && c["type"] in setOf("yes", "unclear", "purpose", "delegate")) || c.token == "maum_3"
            if (!related) return rerun(s, heard, raw)
            val name = when {
                c.token == "maum_0" && Purpose.of(c["purpose"]).let { it != null && it != Purpose.FLAT } -> c["purpose"]
                c.token == "maum_2" && c["type"] == "purpose" -> c["value"]
                else -> null
            }
            // R3(11/04 코덱스 9·10차): "처음으로 돌려"에서 옮기기를 고르면, 처음 각도로 옮기는 기능은 없다고 알리고 지금 저장된 자세로 옮길지 동의를 받는다.
            // 자세 이름을 다시 말해도("잠 자세로 옮겨 줘") 처음 각도를 원하던 요청이 풀린 것이 아니므로 바로 옮기지 않는다. 옮길 자세가 없으면 목적지를 묻는다
            if (p0.firstAngle && c.token == "maum_0" && c.command == "call" &&
                MOVE_ASK.containsMatchIn(MOVE_NEG.replace(heard, " ")) && choiceClear("move", heard, name ?: offered)) {
                val nf = "처음 각도로 옮기는 기능은 없어요."
                val to = name ?: offered
                return if (Purpose.of(to ?: "").let { it != null && it != Purpose.FLAT }) Turn(s.copy(pending = Pending("confirm", "<maum_0>(command=call, purpose=$to, confirm=no)<maum_end>", heard)), say = "$nf 지금 저장된 ${Purpose.of(to)!!.ko} 자세로 옮길까요?")
                else Turn(s.copy(pending = Pending("purpose", "<maum_0>(command=call, purpose=none, confirm=no)<maum_end>", heard)), say = "$nf 어떤 자세로 옮길까요?")
            }
            return when {
                c.token == "maum_0" && c.command == "call" && (name != null || (c["purpose"] == "none" && offeredOk && !p0.firstAngle)) &&
                    MOVE_ASK.containsMatchIn(MOVE_NEG.replace(heard, " ")) && choiceClear("move", heard, name ?: offered) ->
                    rerun(s, heard, if (name == null) setField(raw, "purpose", offered!!) else raw)  // 자세 이름을 생략하면 방금 물은 한 자세만 이어받는다
                c.token == "maum_0" && c.command in setOf("set_default", "reset_default") &&
                    (c["purpose"] !in setOf("none", null) || offeredOk) &&
                    choiceClear(if (c.command == "set_default") "save" else "reset", heard, if (c["purpose"] in setOf("none", null)) offered else c["purpose"]) ->
                    rerun(s, heard, if (c["purpose"] in setOf("none", null)) setField(raw, "purpose", offered!!) else raw)
                else -> reask(name)
            }
        }
        // R6(11/04): 방향을 묻는 중 "올려"·"내려"(부위·양을 새로 말하지 않은 조절)는 묻던 조절에 방향만 채운다. 원래 조절량과 확인 여부는 그대로
        if (p0 != null && p0.kind == "direction" && c.token == "maum_0" && c.command == "adjust" && c["direction"] in setOf("up", "down") &&
            c["amount_type"] == "none" && (c["part"] == "none" || c["part"] == parseKv(p0.output)["part"]))
            return rerun(s, heard, setField(p0.output, "direction", c["direction"]))
        // 알람 종류·난이도를 묻는 중 종류·난이도만 말한 명령이 오면 묻던 알람에 이어 붙인다
        // 새 대상·날짜·범위를 함께 말하면 새 요청으로 처리한다. 값만 보충할 때도 새 말이 바람(confirm=yes)이면 실행 전에 묻는다
        if (p0 != null && ((p0.kind == "alarm_type" && c.command == "change_type" && c["type"] != "none") ||
                (p0.kind == "level" && c.command == "change_level" && c["level"] != "none")) && !newTarget(c, p0)) {
            var out = if (p0.kind == "alarm_type") setField(p0.output, "type", c["type"]) else setField(p0.output, "level", c["level"])
            if (c["confirm"] == "yes") out = setField(out, "confirm", "yes")
            return rerun(s, heard, out)
        }
        // 알람 대상 시각을 한자어 때문에 받지 못했으면, 직전 알람이나 하나뿐인 알람을 대신 고르지 않고 시각부터 다시 묻는다
        if (badHour(heard) && c.token == "maum_1" && c.command in VERB && c["target"] == "none" && s.alarms.isNotEmpty() &&
            !(c.command == "change_time" && c["time"] == "none")) {
            return Turn(s.copy(pending = Pending("alarm", raw, heard)), say = "${Rules.EXACT} 어떤 알람을 ${VERB[c.command]}?")
        }
        if (c.kv["confirm"] == "yes") {
            val direct = raw.replace("confirm=yes", "confirm=no")
            val dc = c.copy(kv = c.kv + ("confirm" to "no"))
            val dry = handle(s0, heard, dc, direct)
            // 바꾸는 게 없으면(없는 알람 안내, 빈 값 되묻기 등) 그대로 답한다
            if (effect(dry.state) == effect(s0)) {
                // 값(시각·양·부위·알람·오전오후)을 먼저 묻는 경우: 값을 받은 뒤에도 바로 실행하지 않고 동의를 묻도록 원래 요청(confirm=yes)을 남긴다
                val dp = dry.state.pending
                return if (dp != null && dp !== s0.pending && dp.kind in setOf("set_time", "amount", "part", "alarm", "ampm", "purpose", "alarm_type", "level", "scope", "skip_start", "direction", "save_or_move"))
                    dry.copy(state = dry.state.copy(pending = dp.copy(output = dp.output.replace("confirm=no", "confirm=yes"), question = dp.question.replace("confirm=no", "confirm=yes")))) else dry
            }
            // 바꾸는 일은 대답 문장과 상관없이 동의 전에는 실행하지 않는다. 질문으로 못 바꾸면 기본 질문으로 묻는다
            val result = dry.state.after.ifEmpty { dry.say }
            val q = toQuestion(result).let { if (it == result) "그렇게 할까요?" else it }
            return Turn(s.copy(pending = Pending("confirm", direct, heard)), say = q, note = "\"응\"이라고 하면 실행해요. 10초 동안 대답이 없으면 그만둬요.")
        }
        return when (c.token) {
            "maum_0" -> posture(s, heard, c, raw)
            "maum_1" -> alarm(s, heard, c, raw)
            "maum_2" -> answer(s0, heard, c, raw)
            "maum_3" -> Turn(s.copy(pending = null), say = when (c["reason"]) {
                "app_only" -> "그건 스마트폰 잘자요 앱에서 설정할 수 있어요"
                "unclear" -> "무엇을 할까요? '머리 올려'나 '알람 꺼'처럼 말씀해 주세요"
                "reservation_time_exceeded" -> "자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요"
                "alarm_time_expression_invalid" -> "몇 시간 뒤로는 24시간 안까지만 맞출 수 있어요. 날짜와 시각으로 말씀해 주세요"
                // R9(11/04): 꺼 둔 알람을 그날만 켜는 요청은 지원하지 않는다. 날짜로 알람을 고르는 것은 되므로 그렇게 말하지 않는다
                // 11/07: 모델이 할 수 있는 요청을 못 알아듣고 out_of_scope로 낼 때도 있어서, 못 한다고 단정하지 않고 다시 말해 달라고 한다
                "out_of_scope" -> if (Regex("켜").containsMatchIn(heard) && Regex("(?:그날|하루|당일|이번|한 번|그 날)만|그날 하루").containsMatchIn(heard)) "꺼 둔 알람을 특정 날짜에만 켜는 기능은 지원하지 않아요" else Rules.MISHEARD
                else -> Rules.MISHEARD
            })
            "maum_4" -> ask(s, heard, c)
            // 11/07: 부르는 말을 듣고도 일반 대화로 나오면 아무 말 없이 넘기지 않는다(할 수 있는 요청을 놓쳤을 수 있음)
            else -> Turn(s, say = Rules.CHAT, note = "일반 대화로 나와 움직이지 않았어요.")
        }
    }

    private fun posture(s: BedState, heard: String, c: Command, raw: String): Turn = when (c.command) {
        "call" -> {
            val p = Purpose.of(c["purpose"])
            if (p == null) Turn(s.copy(pending = Pending("purpose", raw, heard)), say = "어떤 자세로 바꿀까요?")
            else {
                val mem = s.memory[p]
                moveTo(s.copy(lastCalled = p), mem ?: Rules.DEFAULTS.getValue(p), p, "${if (mem != null) "늘 보시던 " else ""}${p.ko} 자세로 바꿨어요", targetMove = true)
            }
        }
        "adjust" -> adjust(s, heard, c, raw)
        "set_angles" -> setAngles(s, heard, c)
        "undo" -> when (c["destination"]) {
            "factory" -> moveTo(s, Angles(0.0, 0.0), null, "처음 자세로 돌아갔어요")
            "saved" -> { val p = s.lastCalled; if (p == null) moveTo(s, Angles(0.0, 0.0), null, "평평하게 맞췄어요") else moveTo(s, s.memory[p] ?: Rules.DEFAULTS.getValue(p), p, "${p.ko} 자세로 돌아갔어요") }
            else -> {
                val u = s.undo
                if (u == null) Turn(s, say = Rules.NOT_NOW)
                else moveTo(s, u.first, u.second, "조절하기 전 자세로 돌아갔어요").let { it.copy(state = it.state.copy(undo = null)) }
            }
        }
        "set_default" -> {
            val p = Purpose.of(c["purpose"]) ?: s.purpose
            when {
                s.moving -> Turn(s, say = "멈춘 뒤에 말씀해 주세요")
                p == null || p == Purpose.FLAT -> Turn(s.copy(pending = Pending("purpose", setField(raw, "purpose", "none"), heard)), say = "어느 자세로 저장할까요? 독서, TV, 휴식, 잠 중에 말해 주세요")
                // 저장해도 그 자세 각도가 그대로면 바꾸는 게 없다. 각도가 바뀌면 동의를 받고 저장한다
                s.target.same(s.memory[p] ?: Rules.DEFAULTS.getValue(p)) -> Turn(s, say = "지금 자세가 이미 ${p.ko} 기본 자세예요")
                else -> Turn(s.copy(pending = Pending("save", setField(raw, "purpose", p.code), heard, angles = s.target)), say = "지금 자세를 ${p.ko} 기본 자세로 저장할까요?")
            }
        }
        "reset_default" -> {
            val p = c["purpose"]
            val q0 = Purpose.of(p)
            // 11/09 이도 님 결정: 저장값 되돌리기는 침대 이동과 상관없다(object 갈림 없앰). to=factory 처음 값, to=previous 바로 전에 저장돼 있던 값
            val prev = c["to"] == "previous"
            val dest = if (prev) "이전 값" else "처음 값"
            val noPrev = prev && p != "none" && !(if (p == "all") s.prevMemory.isNotEmpty() else q0 != null && q0 in s.prevMemory)
            if (noPrev) Turn(s, say = "${if (p == "all") "모든 자세" else "${q0?.ko ?: ""} 자세"}는 되돌릴 이전 값이 없어요")
            else when (p) {
                "none" -> Turn(s.copy(pending = Pending("reset_purpose", raw, heard)), say = if (prev) "어떤 자세를 이전 값으로 되돌릴까요?" else "어떤 자세를 기본 각도로 되돌릴까요?")
                // 저장값 초기화는 하나든 전체든, 저장값이 처음 값과 같아도 늘 한 번 묻는다(11/02 결정). "응"을 들으면 물어본 범위만 되돌린다
                "all" -> Turn(s.copy(pending = Pending("reset", raw, heard)), say = "모든 자세의 저장 각도를 ${dest}으로 되돌릴까요?")
                else -> { val q = Purpose.of(p)!!; Turn(s.copy(pending = Pending("reset", raw, heard)), say = "${q.ko} 자세의 저장 각도를 ${dest}으로 되돌릴까요?") }
            }
        }
        "reserve" -> {
            val p = Purpose.of(c["purpose"])
            val mins = minutesFrom(c)
            when {
                p == null -> Turn(s.copy(pending = Pending("purpose", raw, heard)), say = "어떤 자세로 예약할까요?")
                mins == null -> Turn(s.copy(pending = Pending("set_time", raw, heard)), say = "몇 시에 바꿀까요?")
                // 11/11 이도 님: 예약도 알람처럼 오전·오후를 말하지 않았으면 가까운 쪽으로 짐작해서 확인한다
                c["time_type"] != "relative" && c["ampm"] == "none" && c["time"].take(2).toInt() in 1..12 -> {
                    val guess = if (minutesFrom(c.copy(kv = c.kv + ("ampm" to "am")))!! <= minutesFrom(c.copy(kv = c.kv + ("ampm" to "pm")))!!) "am" else "pm"
                    Turn(s.copy(pending = Pending("ampm", setField(raw, "ampm", guess), heard)), say = "${ampmKo(guess)} ${clockKo(c["time"])}인가요?")
                }
                mins > 24 * 60 -> Turn(s, say = "자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요")
                else -> {
                    val label = timeLabel(c, mins)
                    val target = s.memory[p] ?: Rules.DEFAULTS.getValue(p)
                    val what = if (p == Purpose.FLAT) "평평하게" else "${p.ko} 자세로"
                    val replaced = s.reservation?.let { "기존 ${it.label} 예약 대신 " } ?: ""
                    Turn(s.copy(reservation = Reservation(clock() + mins * 60_000L, label, p, target), pending = null), say = "${replaced}${label}에 $what 바꾸도록 예약했어요")
                }
            }
        }
        "change_reserve" -> {
            val r = s.reservation
            if (r == null) Turn(s, say = Rules.NO_RESERVATION)
            else {
                val name = if (r.purpose == Purpose.FLAT) "평평하게 바꾸는" else "${r.purpose.ko} 자세"
                val tt = c["time_type"]; val t = c["time"]
                if (t == "none" && tt in setOf("earlier", "later")) Turn(s.copy(pending = Pending("amount", raw, heard)), say = "$name 예약을 얼마나 ${if (tt == "earlier") "앞당길까요" else "늦출까요"}?")
                else if (t == "none") Turn(s.copy(pending = Pending("set_time", raw, heard)), say = "$name 예약을 몇 시로 바꿀까요?")
                else {
                    val d = hhmm(t)
                    val at = when (tt) { "earlier" -> r.atMs - d * 60_000L; "later" -> r.atMs + d * 60_000L; else -> clock() + (minutesFrom(c) ?: d) * 60_000L }
                    val left = ((at - clock()) / 60_000L).toInt().coerceAtLeast(1)
                    val label = "${duration(left)} 뒤"
                    val how = when (tt) { "earlier" -> "${duration(d)} 앞당겼어요"; "later" -> "${duration(d)} 늦췄어요"; else -> "${label}로 바꿨어요" }
                    Turn(s.copy(reservation = r.copy(atMs = at, label = label)), say = "$name 예약을 $how")
                }
            }
        }
        "cancel_reserve" -> {
            val r = s.reservation
            val named = Purpose.of(c["purpose"])
            when {
                r == null -> Turn(s, say = Rules.NO_RESERVATION)
                // "잠 예약"(평평)과 "잠 자세 예약"(잠 자세)은 둘 다 잠 예약을 가리키므로, '잠'이라고 말했고 평평이라고 하지 않았으면 같은 갈래로 본다(11/04 B5)
                named != null && named != r.purpose && !(setOf(named, r.purpose) == setOf(Purpose.SLEEP, Purpose.FLAT) &&
                    Regex("잠|수면|자는|잘 때").containsMatchIn(heard) && !Regex("평평|납작|일자").containsMatchIn(heard)) ->
                    Turn(s, say = "현재는 ${r.desc()} 예약이 걸려 있어요")
                else -> Turn(s.copy(reservation = null), say = "${r.label} ${r.desc()} 예약을 취소했어요")
            }
        }
        "cancel_target_move" -> {
            val u = s.undo
            when {
                u == null -> Turn(s, say = Rules.NOT_NOW)
                !s.lastMoveWasTarget -> Turn(s, say = "직전 이동에 대해서만 취소할 수 있어요")
                else -> moveTo(s, u.first, u.second, "이동하기 전 자세로 돌아갔어요").let { it.copy(state = it.state.copy(undo = null)) }
            }
        }
        "reserve_undo" -> {
            val mins = minutesFrom(c)
            val dest = c["destination"]
            val target = when (dest) {
                "previous" -> s.undo?.first
                "saved" -> s.lastCalled?.let { s.memory[it] ?: Rules.DEFAULTS[it] } ?: Angles(0.0, 0.0)
                else -> Angles(0.0, 0.0)
            }
            when {
                mins == null -> Turn(s.copy(pending = Pending("set_time", raw, heard)), say = "몇 시에 돌아갈까요?")
                target == null -> Turn(s, say = "되돌아갈 자세 기록이 없어요")
                else -> {
                    val label = timeLabel(c, mins)
                    val what = when (dest) { "factory" -> "처음 자세로"; "saved" -> if (s.lastCalled != null) "${s.lastCalled.ko} 자세로" else "평평하게"; else -> "머리 ${target.head.roundToInt()}도, 다리 ${target.leg.roundToInt()}도로" }
                    Turn(s.copy(reservation = Reservation(clock() + mins * 60_000L, label, s.purpose ?: Purpose.FLAT, target)), say = "${label}에 $what 돌아가도록 예약했어요")
                }
            }
        }
        else -> Turn(s, say = Rules.NOT_NOW)
    }

    private fun adjust(s: BedState, heard: String, c: Command, raw: String): Turn {
        val amount = c["amount"]; val type = c["amount_type"]
        if (c["part"] == "both") {
            if (type == "target") {
                val v = if (amount == "max") null else amount.toDouble()
                val t = if (v == null) Rules.LIMIT else Angles(clamp(v, Part.HEAD), clamp(v, Part.LEG))
                return moveTo(s, t, s.purpose, if (v == 0.0) "평평하게 맞췄어요" else "머리와 다리를 맞췄어요")
            }
            val dir = c["direction"]
            if (dir != "up" && dir != "down") return Turn(s.copy(pending = Pending("direction", raw, heard)), say = "올릴까요, 내릴까요?")
            val step = stepOf(amount)
            val sign = if (dir == "up") 1 else -1
            val t = Angles(clamp(s.target.head + sign * step, Part.HEAD), clamp(s.target.leg + sign * step, Part.LEG))
            return remember(moveTo(s, t, s.purpose, "머리와 다리를 ${if (dir == "up") "올렸어요" else "내렸어요"}"))
        }
        val part = when (c["part"]) { "head" -> Part.HEAD; "leg" -> Part.LEG; else -> s.lastPart }
            ?: return Turn(s.copy(pending = Pending("part", raw, heard)), say = "어느 쪽을 맞출까요? 머리, 다리 중에 말해 주세요")
        val dir = when (c["direction"]) { "same" -> s.lastDir; "context_up" -> "up"; else -> c["direction"] }
        val cur = s.target[part]
        val to: Double; val result: String
        if (type == "target") {
            // 11/10 Q7: "계속 끝까지"(max, same)는 직전 방향이 내림이면 가장 낮게, 아니면 최대까지
            if (amount == "max" && dir == "down") { to = 0.0; result = "${part.ko}를 가장 낮게 내렸어요" }
            else if (amount == "max") { to = Rules.LIMIT[part]; result = "${part.ko}를 최대인 ${to.roundToInt()}도까지 올렸어요" }
            else { val want = amount.toDouble(); to = clamp(want, part); result = if (to == want) "${part.ko}를 ${to.roundToInt()}도로 맞췄어요" else "${part.ko}를 최대인 ${to.roundToInt()}도까지 올렸어요" }
        } else {
            if (dir != "up" && dir != "down") return Turn(s.copy(pending = Pending("direction", raw, heard)), say = "${part.ko} 올릴까요, 내릴까요?")
            val step = stepOf(amount)
            val want = cur + if (dir == "up") step else -step
            to = clamp(want, part)
            if (abs(to - cur) < 0.5) return Turn(s.copy(lastPart = part, lastDir = dir), say = if (dir == "up") "${part.ko}는 이미 최대인 ${Rules.LIMIT[part].roundToInt()}도예요" else "${part.ko}는 이미 가장 낮아요")
            result = if (to != want && dir == "up") "${part.ko}를 최대인 ${to.roundToInt()}도까지 올렸어요" else "${part.ko}를 ${abs(to - cur).roundToInt()}도 ${if (dir == "up") "올렸어요" else "내렸어요"}"
        }
        val t = moveTo(s, s.target.with(part, to), s.purpose, result, targetMove = type == "target")
        return remember(t.copy(state = t.state.copy(lastPart = part, lastDir = if (to >= cur) "up" else "down")))
    }

    /** 11/10 R4: small 5도, large 20도, none 10도(올릴 때와 내릴 때 모두), 숫자는 그대로 */
    private fun stepOf(amount: String) = when (amount) { "small" -> Rules.SMALL; "large" -> Rules.LARGE; "none" -> Rules.DEFAULT_STEP; else -> amount.toDouble() }

    /** 11/10 Q12: 머리와 다리 각도를 한 번에. 자세 이름이 있으면 침대는 그대로 두고 그 자세 저장값만 바꾼다. 최대를 넘으면 최대로 맞추고 알린다 */
    private fun setAngles(s: BedState, heard: String, c: Command): Turn {
        // 11/11 보드 시험: "사십삼십해줘"를 모델이 머리 43으로 냈다. 들은 글에서 두 수를 다시 읽어 맞춘다
        val fix = anglePair(heard, c["head"].toInt(), c["leg"].toInt())
        val h = (fix?.first ?: c["head"].toInt()).toDouble(); val l = (fix?.second ?: c["leg"].toInt()).toDouble()
        val th = clamp(h, Part.HEAD); val tl = clamp(l, Part.LEG)
        val what = "${if (th < h) "머리는 최대인" else "머리"} ${th.roundToInt()}도, ${if (tl < l) "다리는 최대인" else "다리"} ${tl.roundToInt()}도로 맞췄어요"
        val p = Purpose.of(c["purpose"])
        if (p != null && p != Purpose.FLAT) return Turn(s.copy(memory = s.memory + (p to Angles(th, tl)), pending = null), say = "${p.ko} 자세를 $what")
        val t = moveTo(s, Angles(th, tl), s.purpose, what, targetMove = true)
        return remember(t.copy(state = t.state.copy(lastPart = null, lastDir = null)))
    }

    // ---------- 알람 ----------
    private fun now() = AlarmFinder.nowLocal(clock())
    private fun label(a: AlarmItem) = a.label(now())
    private fun hasJong(w: String): Boolean { val ch = w.trimEnd().lastOrNull() ?: return false; return ch in '가'..'힣' && (ch - '가') % 28 != 0 }
    /** 받침에 맞춰 "로/으로"를 붙인다(ㄹ 받침은 "로") */
    private fun ro(w: String): String { val ch = w.trimEnd().last(); val j = if (ch in '가'..'힣') (ch - '가') % 28 else 0; return w + if (j == 0 || j == 8) "로" else "으로" }
    private fun lab(xs: List<AlarmItem>) = if (xs.size > 1) "알람 ${NATIVE.getOrElse(xs.size) { Brain.sino(xs.size) }} 개" else "${label(xs[0])} 알람"
    private fun obj(xs: List<AlarmItem>) = lab(xs).let { it + if (hasJong(it)) "을" else "를" }
    private fun topic(xs: List<AlarmItem>) = lab(xs).let { it + if (hasJong(it)) "은" else "는" }
    private fun dk(d: java.time.LocalDate) = AlarmItem.dateKo(d, now().toLocalDate())
    private fun nextId(s: BedState) = (s.alarms.maxOfOrNull { it.id } ?: 0) + 1
    private fun setField(out: String, k: String, v: String) = out.replace(Regex("\\b$k=[^,)]*"), "$k=$v")
    private fun hhmmOf(t: java.time.LocalTime) = "%02d:%02d".format(t.hour, t.minute)
    // B4: 옮기기를 부정한 말, 옮기기 요청, 하던 일(저장·되돌리기)을 그만두는 말
    private val MOVE_NEG = Regex("(?:옮기|옮겨|움직이|움직여|가지)\\S*(?: 주지는| 주지| 주진| 주실| \\S{1,3})? ?(?:말고|말아|않|싫|필요\\S* 없|하지 마)|(?:옮기|움직이|가)지(?:도|는)? 마|안 (?:옮|움직)\\S*")
    private val MOVE_ASK = Regex("옮겨|옮기|옮겼|움직여|움직였|가 ?줘|가 ?주세요|가자|가 줄래|갔으면")
    private val SAVE_NEG = Regex("(?:저장|기억|되돌리|되돌려|초기화)\\S*?(?:은|는| 하는 건| 하는 거| \\S{1,3})? ?(?:말고|그만|취소|안 할래|안 해|하지 마|하지 않|됐고|싫|필요\\S* 없)")
    private val SAVE_ASK = Regex("저장|기억|되돌|초기화")
    // save_or_move 임시 방어: 고른 작업을 부정·철회했거나 대상이 풀리지 않은 부정이 남았는지
    // 철회는 앞말에 붙지 않은 독립된 말로 문장 끝에 올 때만 본다("준비됐어"의 됐어는 아님). 한 작업만 거절한 말("저장은 안 할래")은 그 작업의 부정으로 따로 본다
    // 철회하는 말(독립된 낱말). 위치와 상관없이, 있으면 무엇을 철회했는지 알 수 없어 실행하지 않고 다시 묻는다("그만하자, 옮겨 줘"도 다시 물음).
    // 모델이 대화 끝내기(cancel)로 판정하면 위 분기에서 그만둔다. "준비됐어"처럼 앞말에 붙은 것은 철회가 아니다
    private val RETRACT = Regex("(?:^|[ ,])(?:그냥 |아 |아니 |아니다 )?(?:그만하자|그만할래|관두자|관둘래|됐어|됐다|취소할래|취소해)(?=[ ,.!?]|$)")
    private val NEG_MARK = Regex("아니|말고|않|싫|필요\\S* 없|하지 마|말아")
    // 자세 이름: 이름 바로 뒤에는 정해 둔 조사나 '자세·모드'만 올 수 있다("잠깐"·"책상"·"쉬는 날"·"평평하게"는 자세 이름이 아님)
    private val POSTURE_NAME = "(?<![가-힣])(독서|책|티비|티브이|텔레비전|테레비|휴식|쉬는(?= ?자세)|잠|수면|평평)(?: ?(?:자세|모드))?(?:으로|로|이요|요|이|가|은|는|을|를|에)?(?=[ ,.!?]|$)"
    private val POSTURE_MENTION = Regex(POSTURE_NAME + "(,? ?(?:말고|아니(?:고|라)?|가 아니라|이 아니라|는 아니고))?")
    private val POSTURE_CODE = mapOf("독서" to "read", "책" to "read", "티비" to "tv", "티브이" to "tv", "텔레비전" to "tv", "테레비" to "tv", "휴식" to "rest", "쉬는" to "rest", "잠" to "sleep", "수면" to "sleep", "평평" to "flat")
    /** 원문에 나온 자세 이름을 순서대로: (자세 값, 부정했는지). "독서 말고 잠, 아니 독서 자세로" → read(부정), sleep(부정), read */
    internal fun postureMentions(heard: String): List<Pair<String, Boolean>> =
        POSTURE_MENTION.findAll(heard).map { POSTURE_CODE.getValue(it.groupValues[1]) to it.groupValues[2].isNotEmpty() }.toList()
    // chosen: 실행하려는 자세. 이 검사는 최종 자세를 스스로 정하지 않고, 모델 출력과 원문의 부정·정정이 부딪치는지만 본다(8차).
    // 원문에 자세 이름이 있으면 다음을 모두 만족할 때만 통과: 긍정된 서로 다른 자세 값이 하나뿐이고, 그것이 chosen이며, chosen을 마지막으로 말한 때가 긍정.
    // 그래서 배경 언급("독서로 옮겨 줘. 잠 자세는 어제 썼어"), 마지막 철회("독서로 옮겨 줘. 아니 독서는 말고"), 대체값 없는 부정은 다시 묻는다
    private fun choiceClear(kind: String, heard: String, chosen: String?): Boolean {
        if (RETRACT.containsMatchIn(heard)) return false
        val ms = postureMentions(heard)
        if (ms.isNotEmpty()) {
            val affirmed = ms.filter { !it.second }.map { it.first }.toSet()
            if (chosen == null || affirmed != setOf(chosen)) return false
            if (ms.last { it.first == chosen }.second) return false
        }
        // 정정에 쓰인 부정(자세 이름의 "말고·아니", 자세 이름 앞의 "아니")은 풀린 것이라 지운다
        var h = POSTURE_MENTION.replace(heard) { if (it.groupValues[2].isNotEmpty()) " " else it.value }
            .replace(Regex("(?:^|(?<=[ ,]))(?:아 )?(?:아니|아냐|아니요|아니야|아뇨|아니다),? (?=" + POSTURE_NAME + "|[^ ]*(?:옮|움직|저장|기억|되돌|초기화))"), " ")
        when (kind) {
            "move" -> { if (MOVE_NEG.containsMatchIn(h)) return false; h = SAVE_NEG.replace(h, " ") }
            "save" -> { h = MOVE_NEG.replace(h, " ").replace(Regex("(?:초기화|되돌\\S*|리셋)\\S*? ?(?:은|는)? ?(?:말고|말아)"), " "); if (SAVE_NEG.containsMatchIn(h)) return false }
            "reset" -> { h = MOVE_NEG.replace(h, " ").replace(Regex("(?:저장|기억)\\S*? ?(?:은|는)? ?(?:말고|말아)"), " "); if (SAVE_NEG.containsMatchIn(h)) return false }
        }
        return !NEG_MARK.containsMatchIn(h)
    }
    private val TASK_NEG = Regex(SAVE_NEG.pattern + "|그만두고|그만하고|됐고|대신")
    private fun rerun(s: BedState, heard: String, out: String) = handle(s.copy(pending = null), heard, parseKv(out), out)

    /** "07:00"과 오전·오후로 시각을 만든다. 오전·오후가 없으면 old와 같은 쪽, old도 없으면 그대로 */
    private fun clockOf(t: String, ampm: String, old: java.time.LocalTime? = null): java.time.LocalTime {
        var h = t.take(2).toInt() % 24; val m = t.takeLast(2).toInt()
        when (ampm) {
            "pm" -> if (h < 12) h += 12
            "am" -> if (h == 12) h = 0
            else -> if (old != null && old.hour >= 12 && h < 12) h += 12
        }
        return java.time.LocalTime.of(h, m)
    }

    /** 말로 가리킨 알람을 찾는다. 하나로 정해지지 않으면 물어볼 Turn을 돌려준다 */
    private fun targets(s: BedState, heard: String, c: Command, raw: String, verb: String): Pair<List<AlarmItem>?, Turn?> {
        if (s.alarms.isEmpty()) return null to Turn(s, say = "맞춰 둔 알람이 없어요")
        val found = AlarmFinder.find(s.alarms, c, now().toLocalDate())
        val xs = found ?: recent(s)?.let { listOf(it) } ?: if (s.alarms.size == 1) s.alarms else null
        return when {
            xs == null -> null to Turn(s.copy(pending = Pending("alarm", raw, heard)), say = "어떤 알람을 $verb?")
            xs.isEmpty() -> null to Turn(s, say = "말씀하신 알람이 없어요")
            // 넷 이상이면 몇 개 읽고 마는 대신 개수를 말하고 전부인지 묻는다(11/09 이도 님 "고쳐"). "응"이면 전부, 시각을 말하면 그 알람
            xs.size > 3 && c["target"] != "all" -> null to Turn(s.copy(pending = Pending("alarm", raw, heard, alarms = xs)), say = manyAlarms(c, xs, verb))
            // 11/10 이도 님 결정: 읽어 준 목록 바로 뒤 "두 번째 거"를 받으려고 목록을 읽었다는 것을 남긴다(같은 조건으로 다시 찾으면 같은 순서)
            xs.size > 1 && c["target"] != "all" -> null to Turn(s.copy(pending = Pending("alarm", raw, heard, listed = true)),
                say = "${xs.joinToString(", ") { label(it) }} 알람이 있어요. 어떤 알람을 $verb?")
            else -> xs to null
        }
    }

    /** "아침 알람이 열 개 있어요. 전부 끌까요? 하나만이면 몇 시 알람인지 말씀해 주세요" */
    private fun manyAlarms(c: Command, xs: List<AlarmItem>, verb: String): String {
        val part = ampmKo(c["target_ampm"]).let { if (it.isEmpty()) "" else "$it " }
        return "${part}알람이 ${countKo(xs.size)} 개 있어요. 전부 $verb? 하나만이면 몇 시 알람인지 말씀해 주세요"
    }

    private fun update(s: BedState, xs: List<AlarmItem>, f: (AlarmItem) -> AlarmItem?): BedState {
        val ids = xs.map { it.id }.toSet()
        return s.copy(alarms = s.alarms.mapNotNull { if (it.id in ids) f(it) else it }, lastAlarmId = xs.last().id, pending = null)
    }

    private fun setAlarm(s: BedState, heard: String, c: Command, raw: String): Turn {
        val p = s.pending
        // 어떤 알람인지 묻는 중이면 새로 만들지 않고 대상 조건으로 쓴다(설계 977)
        if (p?.kind == "alarm") {
            var out = p.output
            if (c["time"] != "none") { out = setField(out, "target", c["time"]); out = setField(out, "target_ampm", c["ampm"]) }
            if (c["days"] != "none") out = setField(out, "target_days", c["days"])
            if (c["date"] != "none") out = setField(out, "date", c["date"])
            return rerun(s, heard, out)
        }
        val t = c["time"]
        if (t == "none") return Turn(s.copy(pending = Pending("set_time", raw, heard)), say = if (c["date"] != "none") "${dayKo(c["date"])} 알람을 몇 시에 맞출까요?" else "몇 시에 맞출까요?")
        val n = now(); val today = n.toLocalDate()
        val time: java.time.LocalTime; var date: java.time.LocalDate?
        if (c["time_type"] == "relative") {
            val at = n.plusMinutes(hhmm(t).toLong()); time = at.toLocalTime().withSecond(0).withNano(0); date = at.toLocalDate()
        } else {
            if (c["ampm"] == "none" && t.take(2).toInt() in 1..12) {
                // 오전·오후를 말하지 않았으면 가까운 쪽으로 짐작해서 확인한다("오전 일곱 시인가요?")
                val am = clockOf(t, "am"); val d0 = AlarmItem.date(c["date"], today) ?: today
                val guess = if (c["date"] == "none" && d0.atTime(am).isBefore(n) && d0.atTime(clockOf(t, "pm")).isAfter(n)) "pm" else "am"
                return Turn(s.copy(pending = Pending("ampm", setField(raw, "ampm", guess), heard)), say = "${ampmKo(guess)} ${clockKo(t)}인가요?")
            }
            time = clockOf(t, c["ampm"]); date = AlarmItem.date(c["date"], today)
            if (t == "24:00") date = (date ?: today).plusDays(1)  // 이십사 시·자정은 그날이 끝나는 때 = 다음 날 0시
        }
        var days = AlarmItem.days(c["days"])
        if (c["repeat"] == "weekly" && days.isEmpty()) days = setOf((date ?: today).dayOfWeek)
        if (days.isNotEmpty()) date = null
        else if (date == null) date = if (today.atTime(time).isAfter(n)) today else today.plusDays(1)
        val dup = s.alarms.firstOrNull { it.time == time && it.enabled && ((days.isNotEmpty() && it.days.containsAll(days)) || (date != null && it.ringsOn(date))) }
        if (dup != null) return Turn(s.copy(lastAlarmId = dup.id), say = "이미 ${label(dup)} 알람이 맞춰져 있어요")
        val type = if (c["type"] == "none") "basic" else c["type"]
        val a = AlarmItem(nextId(s), time, days, date, type)
        return Turn(s.copy(alarms = s.alarms + a, lastAlarmId = a.id, pending = null), say = "${label(a)}, ${typeKo(type)} 알람으로 맞췄어요")
    }

    /** 그 회차만(scope=once) 바꾸기의 한 대상: 알람, 원래 회차의 날, 바뀐 날짜·시각 */
    private data class OnceMove(val a: AlarmItem, val day: java.time.LocalDate, val at: java.time.LocalDateTime)

    /** 그 회차만(scope=once) 바꾸기(11/04 코덱스 9·10·11차). 고른 알람마다 같은 원칙을 적용한다.
     *  - 바꿀 날: 날짜를 말했으면 그날, 말하지 않았으면("이번만") 그 알람이 다음에 울리는 날
     *  - at: 그 회차(알람, 날)의 바뀐 날짜와 시각. 당기거나 늦춰 자정을 넘으면 날짜도 넘어간다(밤 11시 반을 한 시간 늦추면 다음 날 0시 반)
     *  - 먼저 알람마다 계산하고 확인한 뒤에만 상태를 바꾼다. 다음 알람은 바꾸지 않고(원래 시각·날짜·건너뛰기 그대로) 이유를 알린다
     *    · 그날 울리지 않는 알람(요일이 다름·건너뛰기·꺼 둠)
     *    · 원래 회차가 이미 지난 알람(날짜를 말한 경우)
     *    · 바꾼 결과가 지금이거나 이미 지난 시각인 알람. 다음 날로 옮기거나 원래 회차만 건너뛰게 하지 않는다
     *  - 반복 알람: 그날만 건너뛰고, 바뀐 날짜·시각에 한 번 울리는 알람을 새로 만든다(반복 설정은 그대로)
     *  - 한 번만 울리는 알람: 그 알람의 날짜·시각을 바꾼다
     *  - say: 바꾼 대상으로 안내 문장을 만든다. 바꾸지 않은 대상의 안내는 여기서 붙인다 */
    private fun onceChange(s: BedState, xs: List<AlarmItem>, d0: java.time.LocalDate?, at: (AlarmItem, java.time.LocalDate) -> java.time.LocalDateTime,
                           f: (AlarmItem) -> AlarmItem, say: (List<OnceMove>) -> String): Turn {
        val n = now()
        val ok = mutableListOf<OnceMove>(); val notOn = mutableListOf<AlarmItem>(); val gone = mutableListOf<AlarmItem>(); val past = mutableListOf<AlarmItem>()
        for (a in xs) {
            val d = d0 ?: a.next(n)?.toLocalDate()
            when {
                d == null || !a.ringsOn(d) -> notOn += a
                !d.atTime(a.time).isAfter(n) || (a.lastFired != null && !a.lastFired.isBefore(d.atTime(a.time))) -> gone += a
                !at(a, d).isAfter(n) -> past += a
                else -> ok += OnceMove(a, d, at(a, d))
            }
        }
        var st = s; val made = mutableListOf<AlarmItem>()
        for (m in ok) {
            st = if (m.a.repeating) {
                val u = update(st, listOf(m.a)) { it.copy(skips = it.skips + m.day) }
                made += f(m.a).copy(id = nextId(u) + made.size, time = m.at.toLocalTime(), days = emptySet(), onceDate = m.at.toLocalDate(), skips = emptySet(), offFrom = null, offUntil = null, lastFired = null)
                u
            } else update(st, listOf(m.a)) { f(it).copy(time = m.at.toLocalTime(), onceDate = m.at.toLocalDate()) }
        }
        val why = listOfNotNull(
            notOn.takeIf { it.isNotEmpty() }?.let { "${topic(it)} ${if (d0 != null) "${dk(d0)}에 울리지 않아" else "울릴 예정이 없어"} 바꾸지 않았어요" },
            gone.takeIf { it.isNotEmpty() }?.let { "${topic(it)} 그 회차가 이미 지나 바꾸지 않았어요" },
            past.takeIf { it.isNotEmpty() }?.let { "${topic(it)} 바꾸면 이미 지난 시각이라 바꾸지 않았어요" })
        if (ok.isEmpty()) return Turn(s.copy(pending = null), say = if (xs.isEmpty()) "바꿀 알람이 없어요" else why.joinToString(". "))
        return Turn(st.copy(alarms = st.alarms + made, lastAlarmId = ok.last().a.id, pending = null), say = (listOf(say(ok)) + why).joinToString(". "))
    }
    /** 바꾼 회차의 날: 하나면 "오늘만", 알람마다 다르면 "각 알람의 다음 회차만" */
    private fun onceDay(ms: List<OnceMove>) = ms.map { it.day }.toSet().singleOrNull()?.let { "${dk(it)}만" } ?: "각각 다음 회차만"

    /** R8(11/04): 날짜만 있고 범위를 말하지 않았으면(scope=none) 바꾸기 전에 묻는다. 대상이 모두 한 번만 울리는 알람이면 두 선택의 효과가 같아 묻지 않는다.
     *  대답(once·always)은 범위만 채우고, 원래 요청의 확인 절차는 그대로 이어진다 */
    private fun scopeAsk(s: BedState, raw: String, heard: String, c: Command, xs: List<AlarmItem>, d: java.time.LocalDate?): Turn? {
        if (c["scope"] != "none" || d == null || xs.none { it.repeating }) return null
        return Turn(s.copy(pending = Pending("scope", raw, heard), lastAlarmId = xs.last().id), say = "${dk(d)}만 바꿀까요, 앞으로 계속 바꿀까요?")
    }

    // 11/06 이도 님: "수요일 알람 지워"라고 했는데 수요일만 울리는 알람은 없고 수요일을 포함한 알람(매일·평일 등)만 있으면,
    // 그 사실을 먼저 알리고 원래 안내(예: 매일 오전 여섯 시 알람을 삭제할까요?)를 잇는다. 모델은 말한 요일을 그대로 옮기고 판단은 보드가 한다.
    private val DAY_NOTE_COMMANDS = setOf("change_time", "change_type", "change_level", "skip", "enable", "delete", "off")
    private fun alarm(s: BedState, heard: String, c: Command, raw: String): Turn {
        val t = alarmTurn(s, heard, c, raw)
        if (c.command !in DAY_NOTE_COMMANDS || c["target_days"] == "none" || t.say.isEmpty()) return t
        val want = AlarmItem.days(c["target_days"])
        val found = AlarmFinder.find(s.alarms, c, now().toLocalDate()) ?: return t
        if (want.isEmpty() || found.isEmpty() || found.any { it.repeating && it.days == want }) return t
        val name = when (c["target_days"]) { "daily" -> "매일"; "weekdays" -> "평일"; "weekend" -> "주말"
            else -> want.sorted().joinToString("·") { AlarmItem.DAY_KO.getValue(it) } + "요일" }
        val note = "${name}만 울리는 알람이 없어요. "
        // 묻기만 한 경우(삭제 확인, 어떤 알람인지 등)는 안내만 붙인다
        if (effect(t.state) == effect(s)) return t.copy(say = note + t.say)
        // 바로 실행되는 명령(끄기·건너뛰기·바꾸기·켜기)은 실행하지 않고 먼저 묻는다(11/06 이도 님).
        // "응"을 들으면 찾은 알람의 실제 요일로 다시 실행해 같은 안내를 반복하지 않고 물어본 그 알람에만 적용한다
        val ds = found.map { it.days }.distinct()
        if (ds.size != 1 || !found.all { it.repeating }) return t.copy(say = note + t.say)
        val code = when (ds[0]) { java.time.DayOfWeek.entries.toSet() -> "daily"; AlarmItem.WEEKDAYS -> "weekdays"; AlarmItem.WEEKEND -> "weekend"
            else -> ds[0].sorted().joinToString("+") { d -> AlarmItem.DAY_CODE.entries.first { it.value == d }.key } }
        val q = toQuestion(t.state.after.ifEmpty { t.say }).let { if (it == t.state.after.ifEmpty { t.say }) "그렇게 할까요?" else it }
        return Turn(s.copy(pending = Pending("confirm", setField(setField(raw, "target_days", code), "confirm", "no"), heard)), say = note + q,
            note = "\"응\"이라고 하면 실행해요. 10초 동안 대답이 없으면 그만둬요.")
    }

    private fun alarmTurn(s: BedState, heard: String, c: Command, raw: String): Turn {
        val today = now().toLocalDate()
        when (c.command) {
            "set" -> return setAlarm(s, heard, c, raw)
            "change_time" -> {
                val tt = c["time_type"]; val t = c["time"]
                val (xs0, ask) = targets(s, heard, c, raw, "바꿀까요"); if (ask != null) return ask
                val xs = xs0!!
                if (t == "none" && tt in setOf("earlier", "later")) return Turn(s.copy(pending = Pending("amount", raw, heard), lastAlarmId = xs.last().id), say = "${obj(xs)} 얼마나 ${if (tt == "earlier") "당길까요" else "늦출까요"}?")
                if (t == "none") return Turn(s.copy(pending = Pending("set_time", raw, heard), lastAlarmId = xs.last().id), say = "${obj(xs)} 몇 시로 바꿀까요?")
                val newOf = { a: AlarmItem -> when (tt) {
                    "earlier" -> a.time.minusMinutes(hhmm(t).toLong()); "later" -> a.time.plusMinutes(hhmm(t).toLong())
                    else -> clockOf(t, c["ampm"], a.time)
                } }
                val d = AlarmItem.date(c["date"], today)
                scopeAsk(s, raw, heard, c, xs, d)?.let { return it }
                if (c["scope"] == "once") {
                    // 그 회차의 날짜와 시각에서 당기거나 늦춘다(자정을 넘으면 날짜도 넘어감). 시각을 정해 바꾸면 그날 그 시각
                    val at = { a: AlarmItem, day: java.time.LocalDate -> when (tt) {
                        "earlier" -> day.atTime(a.time).minusMinutes(hhmm(t).toLong()); "later" -> day.atTime(a.time).plusMinutes(hhmm(t).toLong())
                        else -> day.atTime(clockOf(t, c["ampm"], a.time))
                    } }
                    return onceChange(s, xs, d, at, { it }) { ms ->
                        // 안내는 바꾼 방식(time_type)부터 가른다(코덱스 11차). 시각을 정해 바꾸면 그 시각, 당기거나 늦추면 바꾼 양
                        val crossed = ms.filter { it.at.toLocalDate() != it.day }
                        when {
                            // 회차 하나가 날짜를 넘기면 원래 회차와 새 일시를 나눠 말한다
                            ms.size == 1 && crossed.isNotEmpty() -> { val m = ms[0]; "${dk(m.day)} ${AlarmItem.timeKo(m.a.time)} 회차를 ${ro("${dk(m.at.toLocalDate())} ${AlarmItem.timeKo(m.at.toLocalTime())}")} 바꿨어요" }
                            // 정한 시각이 알람마다 같으면 그 시각 하나로, 다르면(오전·오후를 알람에 맞춰 짐작한 경우) 알람마다 말한다
                            tt !in setOf("earlier", "later") || ms.size == 1 -> ms.map { it.at.toLocalTime() }.distinct().let { ts ->
                                if (ts.size == 1) "${obj(ms.map { it.a })} ${onceDay(ms)} ${ro(AlarmItem.timeKo(ts[0]))} 바꿨어요"
                                else "${obj(ms.map { it.a })} ${onceDay(ms)} ${ro(ms.joinToString(", ") { "${label(it.a)} 알람은 ${AlarmItem.timeKo(it.at.toLocalTime())}" })} 바꿨어요" }
                            else -> "${obj(ms.map { it.a })} ${onceDay(ms)} ${duration(hhmm(t))} ${if (tt == "earlier") "당겼어요" else "늦췄어요"}${if (crossed.isNotEmpty()) ". 날짜가 바뀐 알람도 있어요" else ""}"
                        }
                    }
                }
                val nt = newOf(xs[0])
                return Turn(update(s, xs) { it.copy(time = newOf(it)) }, say = "${obj(xs)} ${ro(AlarmItem.timeKo(nt))} 바꿨어요")
            }
            "change_type" -> {
                if (c["type"] == "none") return Turn(s.copy(pending = Pending("alarm_type", raw, heard)), say = "어떤 알람으로 바꿀까요? 침대에서 나와야 꺼지는 알람과 문제를 풀어야 꺼지는 알람이 있어요")
                val (xs0, ask) = targets(s, heard, c, raw, "바꿀까요"); if (ask != null) return ask
                val xs = xs0!!; val type = c["type"]
                val d = AlarmItem.date(c["date"], today)
                scopeAsk(s, raw, heard, c, xs, d)?.let { return it }
                if (xs.all { it.type == type }) return Turn(s.copy(lastAlarmId = xs.last().id), say = "${topic(xs)} 이미 ${typeKo(type)} 알람이에요")
                // 그날 회차만(scope=once): 시각 바꾸기와 같은 방식. 이미 그 종류인 알람은 바꿀 것이 없어 빼고 처리한다
                if (c["scope"] == "once") return onceChange(s, xs.filter { it.type != type }, d, { a, day -> day.atTime(a.time) }, { it.copy(type = type) }) { ms -> "${obj(ms.map { it.a })} ${onceDay(ms)} ${typeKo(type)} 알람으로 바꿨어요" }
                return Turn(update(s, xs) { it.copy(type = type) }, say = "${obj(xs)} ${typeKo(type)} 알람으로 바꿨어요")
            }
            "change_level" -> {
                val xs: List<AlarmItem> = if (c["context"] == "required") {
                    val one = s.ringing?.takeIf { it.type == "question" } ?: recent(s)?.takeIf { it.type == "question" }
                    listOf(one ?: return Turn(s, say = Rules.NOT_NOW))
                } else {
                    // 덧셈·계산·문제를 말한 난이도 요청의 대상은 덧셈 알람
                    val cc = if (c["target_type"] == "none") c.copy(kv = c.kv + ("target_type" to "question")) else c
                    val (found, ask) = targets(s, heard, cc, raw, "바꿀까요"); if (ask != null) return ask; found!!
                }
                scopeAsk(s, raw, heard, c, xs, AlarmItem.date(c["date"], today))?.let { return it }
                if (c["scope"] == "once") return Turn(s, say = "알람 문제 난이도는 날짜를 골라 바꿀 수 없어요")
                val cur = xs[0].level
                val lv = when (c["level"]) { "one" -> 1; "two" -> 2; "up" -> cur + 1; "down" -> cur - 1; else -> return Turn(s.copy(pending = Pending("level", raw, heard)), say = "한 자리와 두 자리 중 어떤 덧셈으로 할까요?") }
                if (lv > 2) return Turn(s, say = "이미 가장 어려운 두 자리 덧셈이에요")
                if (lv < 1) return Turn(s, say = "이미 가장 쉬운 한 자리 덧셈이에요")
                return Turn(update(s, xs) { it.copy(level = lv) }, say = "${lab(xs)} 문제를 ${if (lv == 1) "한 자리" else "두 자리"} 덧셈으로 바꿨어요")
            }
            "skip" -> {
                // v0.9: 한 번 건너뛰기와 기간 끄기를 합친 명령. 말한 범위(다음 한 번·하루·이번 주말·여러 날)만 울리지 않고 그 뒤 원래대로 울린다
                val n = now()
                val ap = c["target_ampm"]
                val inAp = { a: AlarmItem -> AlarmFinder.inDayPart(a.time.hour, ap) }
                val hasTarget = listOf("target", "target_ampm", "target_days", "target_type", "target_order").any { c[it] != "none" }
                val onlyAmpm = !hasTarget || (c["target"] in setOf("none", "all") && listOf("target_days", "target_type", "target_order").all { c[it] == "none" })
                val span = listOf("start", "until", "period").any { c[it] != "none" }
                // R10(11/04): 시작일을 짐작할 수 없으면 바꾸기 전에 묻는다. 대답은 시작일만 채우고, 원래 요청의 확인 절차를 따른다
                if (c["start"] == "ask") return Turn(s.copy(pending = Pending("skip_start", raw, heard)), say = "언제부터 꺼 둘까요?")
                // 시작일만 말했으면 끝을 묻는다(다음 한 번으로 바꾸지 않음)
                if (c["start"] != "none" && c["until"] == "none" && c["period"] == "none") {
                    val from = AlarmItem.date(c["start"], today) ?: today
                    return Turn(s.copy(pending = Pending("skip_span", raw, heard)), say = "${dk(from)}부터 언제까지 꺼 둘까요?")
                }
                val window: Pair<java.time.LocalDate, java.time.LocalDate>? = when {
                    c["date"] == "this_weekend" -> {
                        val sat = today.with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SATURDAY))
                        if (today.dayOfWeek == java.time.DayOfWeek.SUNDAY) today to today else sat to sat.plusDays(1)
                    }
                    c["date"] != "none" -> AlarmItem.date(c["date"], today)!!.let { it to it }
                    span -> {
                        // 11/04(코덱스 16차): "이번 주만 … 주말 빼고"(until=fri)처럼 '이번 주'의 요일이 이미 지났으면, 다가오는 다음 주 요일로 넘기지 않고 안내한다.
                        // '이번 주'는 정답 칸에 남지 않아 들은 문장으로 본다(보조 장치). '이번 주'가 없으면 요일은 지금처럼 다가오는 그 요일이다
                        if (Regex("이번\\s*주").containsMatchIn(heard)) {
                            val mon = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                            val gone = listOf("start", "until").firstOrNull { f -> AlarmItem.DAY_CODE[c[f]]?.let { d -> mon.plusDays((d.value - 1).toLong()).isBefore(today) } == true }
                            if (gone != null) return Turn(s.copy(pending = null), say = "이번 주 ${AlarmItem.DAY_KO.getValue(AlarmItem.DAY_CODE.getValue(c[gone]))}요일은 이미 지나서 꺼 둘 날이 없어요")
                        }
                        val from = AlarmItem.date(c["start"], today) ?: today
                        val until = AlarmItem.date(c["until"], today) ?: from.plusDays(c["period"].toLong() - 1)
                        if (until.isBefore(from)) return Turn(s, say = "끝나는 날이 시작하는 날보다 앞이에요. 다시 말씀해 주세요")
                        from to until
                    }
                    else -> null
                }
                // 지금보다 뒤에 울릴 회차가 그 범위 안에 있는지(지난 오늘 회차는 세지 않음)
                val ringsIn = { a: AlarmItem, w: Pair<java.time.LocalDate, java.time.LocalDate> ->
                    generateSequence(w.first) { it.plusDays(1) }.takeWhile { !it.isAfter(w.second) }.any { d -> a.ringsOn(d) && d.atTime(a.time).isAfter(n) } }
                val days = { w: Pair<java.time.LocalDate, java.time.LocalDate> ->
                    generateSequence(maxOf(w.first, today)) { it.plusDays(1) }.takeWhile { !it.isAfter(w.second) }.toSet() }
                val when_ = { w: Pair<java.time.LocalDate, java.time.LocalDate> -> when {
                    c["date"] == "this_weekend" -> "이번 주말"
                    w.first == w.second -> dk(w.first)
                    else -> "${dk(w.first)}부터 ${dk(w.second)}까지"
                } }
                // 범위 안에 울릴 것이 없을 때 앞말: 오늘은 더 · 내일은 · 모레는 · 그 기간에
                val none_ = { w: Pair<java.time.LocalDate, java.time.LocalDate> -> when {
                    w.first != w.second || c["date"] == "this_weekend" -> "그 기간에"
                    w.first == today -> "오늘은 더"
                    else -> dk(w.first) + if (hasJong(dk(w.first))) "은" else "는"
                } }
                val said = { xs: List<AlarmItem>, w: Pair<java.time.LocalDate, java.time.LocalDate> ->
                    if (w.first == w.second || c["date"] == "this_weekend") "${topic(xs)} ${when_(w)}${if (c["date"] == "this_weekend") "에는" else if (hasJong(when_(w))) "은" else "는"} 울리지 않아요"
                    else "${obj(xs)} ${when_(w)} 꺼 뒀어요. ${dk(w.second.plusDays(1))}부터 다시 울려요" }
                // 대상 없이 말한 하루짜리(다음 한 번·그날·이번 주말)는 그날 회차 전부. 여러 날은 "전부"라고 했을 때만 전부이고,
                // 대상을 생략하거나 "이 알람"이면 기간 끄기의 대상 규칙(직전 알람·하나뿐인 알람, 아니면 묻기)을 따른다
                if (onlyAmpm && (!span || c["target"] == "all")) {
                    if (window == null) {
                        // 특정 알람이 없으면 알람이 있는 다음 날 회차 전부. 오전·오후만 말했으면 그날 그쪽 알람 전부
                        val day = (0..7).map { today.plusDays(it.toLong()) }.firstOrNull { x -> s.alarms.any { a -> inAp(a) && a.ringsOn(x) && x.atTime(a.time).isAfter(n) } }
                            ?: return Turn(s, say = "건너뛸 알람이 없어요")
                        val xs = s.alarms.filter { inAp(it) && it.ringsOn(day) && day.atTime(it.time).isAfter(n) }
                        return Turn(update(s, xs) { it.copy(skips = it.skips + day) }, say = if (ap == "none") "${dk(day)} 알람을 전부 건너뛰었어요" else "${dk(day)} ${ampmKo(ap)} 알람을 건너뛰었어요")
                    }
                    val xs = s.alarms.filter { inAp(it) && ringsIn(it, window) }
                    if (xs.isEmpty()) return Turn(s, say = "${none_(window)} 울릴 ${if (ap == "none") "" else ampmKo(ap) + " "}알람이 없어요")
                    val st = update(s, xs) { it.copy(skips = it.skips + days(window)) }
                    if (window.first == window.second && c["date"] != "this_weekend")
                        return Turn(st, say = if (ap == "none") "${dk(window.first)} 알람을 전부 건너뛰었어요" else "${dk(window.first)} ${ampmKo(ap)} 알람을 건너뛰었어요")
                    return Turn(st, say = said(xs, window))
                }
                val (xs0, ask) = targets(s, heard, c, raw, if (span) "꺼 둘까요" else "건너뛸까요"); if (ask != null) return ask
                val xs = xs0!!
                if (window == null) {
                    val day = xs[0].next(n)?.toLocalDate() ?: return Turn(s, say = "다음에 울릴 회차가 없어요")
                    return Turn(update(s, xs) { it.copy(skips = it.skips + day) }, say = "${topic(xs)} ${dk(day)}은 울리지 않아요")
                }
                // 말한 알람만 바꾼다. 범위 안에 더 울릴 회차가 없으면(지난 오늘 등) 다른 날로 옮기지 않고 알린다
                if (xs.none { ringsIn(it, window) }) return Turn(s.copy(lastAlarmId = xs.last().id),
                    say = "${topic(xs)} ${none_(window)} 울릴 회차가 없어요")
                return Turn(update(s, xs) { it.copy(skips = it.skips + days(window)) }, say = said(xs, window))
            }
            "enable" -> {
                val d = AlarmItem.date(c["date"], today)
                val isOff = { a: AlarmItem -> !a.enabled || (a.offUntil != null && !today.isAfter(a.offUntil)) || (if (d != null) d in a.skips else a.skips.any { !it.isBefore(today) }) }
                val found = AlarmFinder.find(s.alarms, c, today)
                val xs = (found ?: s.alarms).filter(isOff)
                if (xs.isEmpty()) return Turn(s, say = "꺼 둔 알람이 없어요")
                if (xs.size > 3 && found == null) return Turn(s.copy(pending = Pending("alarm", raw, heard, alarms = xs)), say = "꺼 둔 " + manyAlarms(c, xs, "켤까요"))
                if (xs.size > 1 && found == null) return Turn(s.copy(pending = Pending("alarm", raw, heard)), say = "꺼 둔 알람이 ${xs.joinToString(", ") { label(it) }} 알람이에요. 어떤 알람을 켤까요?")
                if (d != null) return Turn(update(s, xs) { it.copy(skips = it.skips - d) }, say = "${topic(xs)} ${dk(d)} 회차만 다시 켰어요")
                return Turn(update(s, xs) { it.copy(enabled = true, offFrom = null, offUntil = null, skips = it.skips.filter { d0 -> d0.isBefore(today) }.toSet()) }, say = "${obj(xs)} 다시 켰어요")
            }
            "delete" -> {
                val (xs0, ask) = targets(s, heard, c, raw, "삭제할까요"); if (ask != null) return ask
                val xs = xs0!!
                // 삭제는 되돌릴 수 없어 대상을 말하고 동의를 받는다. "응"을 들으면 다시 찾지 않고 물어본 알람만 지운다
                val q = when {
                    xs.size == 1 -> "${obj(xs)} 삭제할까요?"
                    xs.size == s.alarms.size -> "${obj(xs)} 전부 삭제할까요?"
                    else -> "${xs.take(3).joinToString(", ") { label(it) }} ${obj(xs)} 삭제할까요?"
                }
                return Turn(s.copy(pending = Pending("delete", raw, heard, alarms = xs)), say = q)
            }
            "off" -> {
                val (xs0, ask) = targets(s, heard, c, raw, "끌까요"); if (ask != null) return ask
                val xs = xs0!!
                if (s.ringing != null && xs.any { it.id == s.ringing.id }) return Turn(s, say = Rules.NOT_NOW)
                return Turn(update(s, xs) { it.copy(enabled = false) }, say = "${obj(xs)} 꺼 뒀어요")
            }
            "delay_active" -> {
                val r = s.ringing ?: return Turn(s, say = "지금은 미룰 수 있는 진행 중 알람이 없어요")
                val m = if (c["time"] == "none") 5 else hhmm(c["time"])
                if (m > 30) return Turn(s, say = "최대 삼십 분까지 미룰 수 있어요. 몇 분 미룰까요?")
                return Turn(s.copy(ringing = null, question = null, snoozeAt = clock() + m * 60_000L, lastAlarmId = r.id, pending = null), say = "${Brain.sino(m)} 분 미뤘어요")
            }
        }
        return Turn(s, say = Rules.NOT_NOW)
    }

    /** 대상 없이 "그거"로 시키는 말: 방금 이야기한 알람(없으면 걸린 예약)에 적용한다 */
    private fun request(s: BedState, heard: String, c: Command): Turn {
        val op = c["operation"]
        val a = recent(s)
        val tgt = a?.let { val h = it.time.hour % 12; "target=%02d:%02d, target_ampm=%s".format(if (h == 0) 12 else h, it.time.minute, if (it.time.hour < 12) "am" else "pm") }
        return when (op) {
            // R1(11/04): 묻는 것이 없고, 지금 움직임이 바로 앞 말로 시작된 것이면 그 요청을 취소해 멈춘다. 연결이 불분명하면 묻는다. 예약은 건드리지 않는다
            "cancel" -> when {
                s.pending != null -> Turn(s.copy(pending = null), say = "그만둘게요")
                s.moving && s.turnTarget != null && s.turnTarget == s.target -> stopNow(s, "방금 요청을 취소해서 멈췄어요.")
                else -> Turn(s, say = "무엇을 취소할까요?")
            }
            "delay", "advance" -> {
                val tt = if (op == "delay") "later" else "earlier"
                if (tgt == null && s.reservation != null) rerun(s, heard, "<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=${c["time"]}, time_type=$tt, confirm=no)<maum_end>")
                else if (tgt == null) Turn(s, say = "어떤 알람을 ${if (op == "delay") "늦출까요" else "당길까요"}?")
                else rerun(s, heard, "<maum_1>(command=change_time, $tgt, time=${c["time"]}, time_type=$tt, confirm=no)<maum_end>")
            }
            // 11/11: 방금 읽어 준 목록이 있고 "다 지워"(target=all)면 그 목록 전부를 지울지 묻는다
            "delete" -> if (c["target"] == "all" && clock() <= s.listedUntil && s.listed.isNotEmpty() && s.listed.all { id -> s.alarms.any { it.id == id } }) {
                    val xs = s.alarms.filter { it.id in s.listed }
                    Turn(s.copy(pending = Pending("delete", "<maum_1>(command=delete, target=all, target_ampm=none, target_days=none, date=none, state=any, target_type=none, target_order=none, confirm=no)<maum_end>", heard, alarms = xs)), say = "방금 말씀드린 ${obj(xs)} 모두 삭제할까요?")
                } else if (tgt == null) Turn(s, say = "무엇을 삭제할까요?")
                else Turn(s.copy(pending = Pending("delete", "<maum_1>(command=delete, $tgt, confirm=no)<maum_end>", heard, alarms = listOf(a))), say = "${label(a)} 알람을 삭제할까요?")
            "skip" -> if (tgt == null) Turn(s, say = "어떤 알람을 건너뛸까요?")
                else {
                    val day = AlarmItem.date(c["date"], now().toLocalDate()) ?: a.next(now())?.toLocalDate()
                    Turn(s.copy(pending = Pending("confirm", "<maum_1>(command=skip, $tgt, target_days=none, date=${c["date"]}, start=none, until=none, period=none, target_type=none, target_order=none, confirm=no)<maum_end>", heard)), say = "${label(a)} 알람의 ${day?.let { dk(it) } ?: "다음"} 회차를 건너뛸까요?")
                }
            else -> Turn(s, say = Rules.NOT_NOW)
        }
    }

    /** 동의받은 삭제: 물어본 알람이 그대로일 때만 그 알람만 지운다 */
    private fun deleteAsked(s: BedState, p: Pending): Turn {
        val xs = p.alarms.orEmpty()
        if (xs.isEmpty() || !s.alarms.containsAll(xs)) return Turn(s.copy(pending = null), say = "그사이 알람이 바뀌어서 삭제하지 않았어요. 다시 말씀해 주세요")
        val all = xs.size > 1 && xs.size == s.alarms.size
        return Turn(update(s, xs) { null }.copy(pending = null, lastAlarmId = null), say = "${obj(xs)} ${if (all) "전부 " else ""}삭제했어요")
    }

    /** 동의받은 저장: 물어본 자세가 그대로일 때만 저장한다(설계: 바뀐 각도를 말없이 저장하지 않음) */
    private fun saveAsked(s: BedState, p: Pending): Turn {
        val q = Purpose.of(parseKv(p.output)["purpose"])
        return when {
            s.moving -> Turn(s.copy(pending = null), say = "멈춘 뒤에 말씀해 주세요")
            q == null || p.angles?.same(s.target) != true -> Turn(s.copy(pending = null), say = "그사이 자세가 바뀌어서 저장하지 않았어요. 다시 말씀해 주세요")
            else -> Turn(s.copy(memory = s.memory + (q to s.target), purpose = q, pending = null), say = "지금 자세를 ${q.ko} 기본 자세로 저장했어요")
        }
    }

    /** 대답 처리. 묻는 중에 기다리는 종류가 아닌 대답이 오면 상태를 그대로 두고 무엇을 말해야 하는지와 직전 질문을 다시 한다 */
    private fun answer(s: BedState, heard: String, c: Command, raw: String): Turn {
        val t = answerInner(s, heard, c, raw)
        val p = s.pending
        return if (p != null && t.say == Rules.NOT_NOW && t.state.pending == p) reask(s, heard) ?: t else t
    }

    /** 동의받은 저장값 초기화: 물어본 범위(자세 하나 또는 전체)만 처음 값으로 되돌린다 */
    private fun resetAsked(s: BedState, p: Pending): Turn {
        val kv = parseKv(p.output); val v = kv["purpose"]
        if (kv["to"] == "previous") {
            fun back(m: Map<Purpose, Angles>, q: Purpose): Map<Purpose, Angles> = s.prevMemory[q].let { if (it == null) m - q else m + (q to it) }
            if (v == "all") {
                if (s.prevMemory.isEmpty()) return Turn(s.copy(pending = null), say = "모든 자세는 되돌릴 이전 값이 없어요")
                return Turn(s.copy(memory = s.prevMemory.keys.fold(s.memory) { m, q -> back(m, q) }, pending = null), say = "모든 자세의 저장 각도를 이전 값으로 되돌렸어요")
            }
            val q = Purpose.of(v) ?: return Turn(s.copy(pending = null), say = "어떤 자세를 이전 값으로 되돌릴까요?")
            if (q !in s.prevMemory) return Turn(s.copy(pending = null), say = "${q.ko} 자세는 되돌릴 이전 값이 없어요")
            return Turn(s.copy(memory = back(s.memory, q), pending = null), say = "${q.ko} 자세의 저장 각도를 이전 값으로 되돌렸어요")
        }
        if (v == "all") return Turn(s.copy(memory = emptyMap(), pending = null), say = "모든 자세의 저장 각도를 처음 값으로 되돌렸어요")
        val q = Purpose.of(v) ?: return Turn(s.copy(pending = null), say = "어떤 자세를 기본 각도로 되돌릴까요?")
        return Turn(s.copy(memory = s.memory - q, pending = null), say = "${q.ko} 자세의 저장 각도를 처음 값으로 되돌렸어요")
    }

    /** 묻던 명령의 칸 하나를 대답으로 채운다. 그 칸이 없으면 다시 묻고, 동의를 묻던 중이면 바꾼 내용으로 다시 묻는다(바로 실행하지 않음) */
    private fun refill(s: BedState, heard: String, p: Pending, k: String, v: String): Turn {
        if (!Regex("\\b$k=").containsMatchIn(p.output)) return reask(s, heard) ?: Turn(s, say = Rules.NOT_NOW)
        val out = setField(p.output, k, v)
        return if (p.kind == "confirm") rerun(s, heard, setField(out, "confirm", "yes")) else rerun(s, heard, out)
    }

    private fun answerInner(s: BedState, heard: String, c: Command, raw: String): Turn {
        val p = s.pending
        if (c.command == "select_alarm") {
            // 종류를 묻는 중("어떤 알람으로 바꿀까요?") 종류만 가리킨 대답("소리만 나는 기본 알람이요")은 새 종류로 쓴다(11/04 경계 점검)
            if (p?.kind == "alarm_type" && c["target_type"] != "none" && listOf("target", "target_ampm", "target_days", "target_order", "date").all { c[it] == "none" })
                return rerun(s, heard, setField(p.output, "type", c["target_type"]))
            if (p?.kind != "alarm") return Turn(s, say = Rules.NOT_NOW)
            var out = p.output
            for (k in listOf("target", "target_ampm", "target_days", "target_type", "target_order", "date")) if (c[k] != "none") out = setField(out, k, c[k])
            return rerun(s, heard, out)
        }
        if (c.command == "request") return request(s, heard, c)
        val v = c["value"]
        return when (c["type"]) {
            // R4(11/04): 고를 일을 맡기는 말은 동의가 아니다. 묻던 것이 있으면 그 내용을 다시 말하고 분명한 동의를 받고, 없으면 무엇을 할지 묻는다
            "delegate" -> when {
                p == null -> Turn(s, say = Rules.WHAT, note = "맡기는 말이라 무엇을 할지 물어요.")
                p.kind in setOf("confirm", "delete", "save", "reset") -> Turn(s, say = "${p.question.ifEmpty { "방금 물어본 대로 할까요?" }} 하시려면 '응'이라고 말씀해 주세요")
                else -> Turn(s, say = "${p.question.ifEmpty { "무엇으로 할까요?" }} 정해서 말씀해 주세요")
            }
            "yes" -> when (p?.kind) {
                "confirm", "ampm" -> rerun(s, heard, p.output)
                "delete" -> deleteAsked(s, p)
                "save" -> saveAsked(s, p)
                "reset" -> resetAsked(s, p)
                // "알람이 열 개 있어요. 전부 끌까요?"에 "응"이면 그 조건의 알람 전부. 전부 하겠느냐는 물음에 답했으니 다시 확인하지 않는다
                "alarm" -> if (p.alarms != null) rerun(s, heard, setField(setField(p.output, "target", "all"), "confirm", "no"))
                    else reask(s, heard) ?: Turn(s, note = "물어본 것이 없어서 대답하지 않아요.")
                // 시각·양·부위·알람을 묻는 중의 "응"은 기다리는 대답이 아니라 다시 묻는다
                null -> if (s.moving) Turn(s, note = "움직이는 중이라 그대로 둬요.")
                    // 물은 것이 없는 동의("알아서 해", 늦게 온 "응")는 무엇을 할지 묻는다(11/03 결정)
                    else Turn(s, say = Rules.WHAT, note = "물어본 것이 없는 동의예요.")
                else -> reask(s, heard) ?: Turn(s, note = "물어본 것이 없어서 대답하지 않아요.")
            }
            "no" -> when (p?.kind) {
                "ampm" -> rerun(s, heard, p.output.let { if ("ampm=am" in it) setField(it, "ampm", "pm") else setField(it, "ampm", "am") })
                null -> Turn(s, note = "물어본 것이 없어서 대답하지 않아요.")
                else -> Turn(s.copy(pending = null), note = "물어보던 것을 끝내고 대답하지 않아요.")
            }
            "cancel" -> if (p != null) Turn(s.copy(pending = null), say = "그만둘게요") else if (s.moving) stopNow(s, "그만하라는 말로 멈췄어요.") else Turn(s, note = "그만둘 일이 없어요.")
            "part" -> if (p?.kind == "part") rerun(s, heard, p.output.replace("part=none", "part=$v")) else if (p != null) reask(s, heard) ?: Turn(s, say = Rules.NOT_NOW) else Turn(s, say = "${if (v == "leg") "다리" else "머리"} 올릴까요, 내릴까요?")
            "ampm" -> when {
                // 날짜 전체 건너뛰기를 묻는 중 "오전만": 그 날짜에서 대상만 좁혀 다시 묻는다(바로 실행하지 않음)
                askingSkipAll(p) -> rerun(s, heard, setField(setField(p!!.output, "target_ampm", v), "confirm", "yes"))
                else -> when (p?.kind) {
                "ampm", "set_time" -> rerun(s, heard, setField(p.output, "ampm", v))
                "confirm" -> refill(s, heard, p, "ampm", v)
                "alarm" -> rerun(s, heard, setField(p.output, "target_ampm", v))
                else -> Turn(s, say = Rules.NOT_NOW)
                }
            }
            "time" -> {
                val v = timeBefore(heard) ?: v  // 11/10 B8: "일곱 시 십 분 전이요"는 들은 말에서 계산한다(맥 numfix와 같은 범위)
                val ap = if (v.startsWith("am_") || v.startsWith("pm_")) v.take(2) else "none"; val t = v.removePrefix("am_").removePrefix("pm_")
                when (p?.kind) {
                    "set_time" -> rerun(s, heard, setField(setField(setField(p.output, "time", t), "ampm", ap), "time_type", "absolute"))
                    "alarm" -> rerun(s, heard, setField(setField(p.output, "target", t), "target_ampm", ap))
                    // 묻는 것이 없을 때 시각만 말하면("여섯 시 이십칠 분에 맞춰") 새 알람을 바로 만들지 않고 먼저 묻는다(11/04 경계 점검)
                    null -> rerun(s, heard, "<maum_1>(command=set, date=none, ampm=$ap, time=$t, time_type=absolute, type=none, repeat=none, days=none, confirm=yes)<maum_end>")
                    else -> Turn(s, say = Rules.NOT_NOW)
                }
            }
            "relative_time", "duration" -> when (p?.kind) {
                // 시작일만 말한 건너뛰기에 "사흘 동안"처럼 날 수로 대답
                "skip_span" -> if (v.startsWith("days_")) rerun(s, heard, setField(p.output, "period", v.drop(5))) else reask(s, heard) ?: Turn(s, say = Rules.NOT_NOW)
                // "사흘"(days_N)처럼 시각으로 쓸 수 없는 대답이면 상태를 그대로 두고 같은 질문을 다시 한다
                "amount", "set_time" -> if (!Regex("\\d\\d:\\d\\d").matches(v)) (reask(s, heard) ?: Turn(s, say = rerun(s, p.heard, p.output).say))
                    else if (p.kind == "amount") rerun(s, heard, setField(p.output, "time", v))
                    else rerun(s, heard, setField(setField(p.output, "time", v), "time_type", "relative"))
                // R2(11/04): 묻는 것도 울리는 알람도 없으면 새 알람으로 정하지 않고, 무엇을 그만큼 할지 묻는다('더'는 원문으로 보존)
                null -> if (Regex("\\d\\d:\\d\\d").matches(v)) Turn(s, say = "무엇을 ${duration(hhmm(v))}${if (Regex("더").containsMatchIn(heard)) " 더" else ""} 할까요?") else Turn(s, say = Rules.NOT_NOW)
                else -> Turn(s, say = Rules.NOT_NOW)
            }
            "date" -> if (p?.kind == "skip_span") rerun(s, heard, setField(p.output, "until", v)) else if (p?.kind == "skip_start") rerun(s, heard, setField(p.output, "start", v)) else if (p != null) refill(s, heard, p, "date", v) else Turn(s, say = Rules.NOT_NOW)
            "scope" -> if (p != null) refill(s, heard, p, "scope", if (v == "once") "once" else "always") else Turn(s, say = Rules.NOT_NOW)  // 11/04: always를 none으로 바꾸지 않는다
            "selection" -> if (p?.kind == "alarm") rerun(s, heard, setField(p.output, "target", "all")) else Turn(s, say = Rules.NOT_NOW)
            "number" -> {
                val q = s.question
                if (s.ringing?.type == "question" && q != null) {
                    // 사용자가 마지막에 답으로 말한 수 하나와 모델 숫자가 같을 때만 판정한다(11/03).
                    // 말끝이 애매해 두 값이 되거나("육십이요"), 모델이 다른 수를 내거나(자릿수 오류, 앞에서 고친 수) 수를 못 찾으면 다시 묻는다
                    val fin = finalAnswer(heard)
                    // 두 값으로 들리면 두 값을 짚고 '요' 없이 숫자만 말해 달라고 한다. "육십"·"육십이"처럼 끝을 빼면 하나로 정해진다
                    if (fin.size == 2) Turn(s, say = "${Brain.sino(fin.min())}인지 ${Brain.sino(fin.max())}인지 헷갈려요. 끝에 요 없이 숫자만 말씀해 주세요.", note = "말끝이 애매해 두 값($fin)으로 들려 판정하지 않았어요.")
                    // 11/10 B7: 들은 말에서 읽은 수가 하나면 모델 숫자 대신 그 수로 판정한다(1B 모델의 수 조합 실수를 피함)
                    else if (fin.size != 1) Turn(s, say = "다시 한 번 말씀해 주세요. ${Brain.sino(q.first)} 더하기 ${Brain.sino(q.second)}는 얼마예요?", note = "마지막 답을 하나로 찾지 못해($fin, 모델 $v) 판정하지 않았어요.")
                    else if (fin[0] == q.first + q.second) Turn(s.copy(ringing = null, question = null), say = "정답이에요. 좋은 아침이에요 알람을 끌게요")
                    else Turn(s, say = "다시 생각해 보세요. ${Brain.sino(q.first)} 더하기 ${Brain.sino(q.second)}는 얼마예요?")
                } else if (p?.kind == "part") reask(s, heard) ?: Turn(s, say = "어느 쪽을 맞출까요? 머리, 다리 중에 말해 주세요")
                else Turn(s, say = Rules.NOT_NOW)
            }
            "purpose" -> {
                val pp = Purpose.of(v)
                if (p != null && "purpose=none" in p.output) rerun(s, heard, p.output.replace("purpose=none", "purpose=$v"))
                else if (pp != null) Turn(s.copy(pending = Pending("confirm", "<maum_0>(command=call, purpose=$v, confirm=no)<maum_end>", heard)), say = "${pp.ko} 자세로 바꿀까요?")
                else Turn(s, say = Rules.NOT_NOW)
            }
            "reference" -> when {
                s.moving -> stopNow(s, "움직이지 말라는 말을 듣고 그 자리에서 멈췄어요.")
                p != null -> Turn(s.copy(pending = null), note = "물어보던 제안을 접고 그대로 둬요.")
                else -> Turn(s, note = "움직이는 중이 아니라서 할 일이 없어요.")
            }
            "bad" -> {
                val undoOut = "<maum_0>(command=undo, confirm=no, part=none, destination=previous)<maum_end>"
                when {
                    s.moving -> { val t = stopNow(s, "불편하다는 말을 듣고 멈췄어요."); t.copy(state = t.state.copy(pending = Pending("confirm", undoOut, heard)), say = "멈췄어요. 직전 자세로 돌릴까요?") }
                    s.undo != null -> Turn(s.copy(pending = Pending("confirm", undoOut, heard)), say = "직전 자세로 돌릴까요?")
                    else -> Turn(s, say = "어떻게 바꿔 드릴까요?")
                }
            }
            // 쓰지 않는 한자어 시각이라 알아듣지 못한 대답이면 정확한 시각을 다시 묻는다
            "unclear" -> if (badHour(heard)) (reask(s, heard) ?: Turn(s, say = Rules.EXACT)) else Turn(s, say = "천천히 생각하셔도 돼요. 정하시면 말씀해 주세요")
            "wait" -> Turn(s, note = "망설이는 말이라 말을 끊지 않고 기다려요.")
            "order" -> if (p?.kind == "alarm" && p.listed && "target_order=" in p.output) rerun(s, heard, setField(p.output, "target_order", v))
                else Turn(s, say = "몇 시 알람인지 정확한 시각으로 말씀해 주세요")
            else -> Turn(s, say = Rules.NOT_NOW)
        }
    }

    private fun ask(s: BedState, heard: String, c: Command): Turn = when (c.command) {
        "tell_time" -> { val n = now(); Turn(s, say = "지금은 ${if (n.hour < 12) "오전" else "오후"} ${clockKo(hhmmOf(n.toLocalTime()))}이에요") }
        "tell_angles" -> Turn(s, say = Purpose.of(c["purpose"])?.takeIf { it != Purpose.FLAT }?.let { p ->
            // 11/10 Q13: 자세 이름을 물으면 그 자세에 저장된 각도(저장한 적 없으면 처음 값)
            val a = s.memory[p] ?: Rules.DEFAULTS.getValue(p)
            when (c["part"]) {   // 11/10 Q19: 자세와 부위를 함께 물으면 그 부위만
                "head" -> "${p.ko} 자세 머리는 ${a.head.roundToInt()}도예요"
                "leg" -> "${p.ko} 자세 다리는 ${a.leg.roundToInt()}도예요"
                else -> "${p.ko} 자세는 머리 ${a.head.roundToInt()}도, 다리 ${a.leg.roundToInt()}도예요"
            }
        } ?: when (c["part"]) {
            "head" -> "지금 머리는 ${s.angles.head.roundToInt()}도예요"
            "leg" -> "지금 다리는 ${s.angles.leg.roundToInt()}도예요"
            else -> "지금 머리는 ${s.angles.head.roundToInt()}도, 다리는 ${s.angles.leg.roundToInt()}도예요"
        })
        "tell_reservations" -> Turn(s, say = s.reservation?.let { "${it.label}에 ${it.desc()} 예약이 있어요" } ?: Rules.NO_RESERVATION)
        "tell_capabilities" -> Turn(s, say = "저는 자세 바꾸기, 각도 조절, 자세 예약, 알람을 맞출 수 있어요. 자세한 건 스마트폰 잘자요 앱에서 볼 수 있어요")
        "repeat_last" -> Turn(s, say = s.lastSpeech.ifEmpty { "다시 말씀드릴 안내가 없어요" })
        "tell_reason" -> Turn(s, say = when {
            s.pending != null -> "바꿔도 될지 대답을 아직 못 들어서 기다리고 있었어요. 지금 바꿀까요?"
            s.moving -> "지금 움직이고 있어요"
            else -> "왜 그런지 확인하지 못했어요"
        })
        "tell_alarms" -> if (c["date"] == "none" && c["days"] == "none" && UNKNOWN_DAY.containsMatchIn(heard)) {
            // 11/11 보드 시험: "어제·이번 주 알람"처럼 날짜를 말했는데 모델이 날짜를 비우면, 다른 날 알람을 읽지 않는다
            Turn(s, say = "말씀하신 날의 알람은 알려 드릴 수 없어요. 오늘이나 내일처럼 말씀해 주세요")
        } else {
            // 전체 목록은 읽지 않는다. 날짜를 말하면 그날, 아니면 알람이 있는 다음 날의 알람을 세 개까지
            val today = now().toLocalDate()
            val asked = AlarmItem.date(c["date"], today)
            val wantDays = AlarmItem.days(c["days"])
            // 11/10 R7: 종류를 말하면(덧셈 알람 몇 시였지) 그 종류 알람만. 날짜가 없으면 그 종류 알람이 있는 다음 날
            val type = c["target_type"].takeIf { it != "none" }
            val pool = if (type == null) s.alarms else s.alarms.filter { it.type == type }
            val day = asked ?: (0..7).map { today.plusDays(it.toLong()) }.firstOrNull { d -> pool.any { it.ringsOn(d) && (d != today || d.atTime(it.time).isAfter(now())) } }
            val xs = if (day == null) emptyList() else pool.filter { it.ringsOn(day) && (wantDays.isEmpty() || it.days.any { d -> d in wantDays }) }.sortedBy { it.time }
            Turn(s, say = when {
                day == null && type != null -> "${typeKo(type)} 알람은 없어요"
                day == null -> "맞춰 둔 알람이 없어요"
                xs.isEmpty() && type != null -> "${dk(day)}은 ${typeKo(type)} 알람이 없어요"
                xs.isEmpty() -> "${dk(day)}은 알람이 없어요"
                else -> "${dk(day)} 알람은 " + xs.take(3).joinToString(", ") { "${AlarmItem.timeKo(it.time)} ${typeKo(it.type)} 알람" } +
                    (if (xs.size == 1) " 하나예요" else "이 있어요") + (if (xs.size > 3) ". 그 외 나머지는 앱에서 확인해 주세요" else "")
            }).let { t -> if (xs.isEmpty()) t else t.copy(state = t.state.copy(listed = xs.take(3).map { it.id }, listedUntil = clock() + RECENT_MS)) }
        }
        else -> Turn(s, say = Rules.NOT_NOW)
    }

    // ---------- 알람 울리기(보드 앱이 매 순간 부른다) ----------
    /** 울릴 때가 된 알람이 있으면 울리는 상태로 바꾼다 */
    fun dueAlarm(s: BedState): Turn? {
        if (s.ringing != null || !s.timeValid) return null
        val n = now()
        s.snoozeAt?.let { at ->
            if (clock() >= at) { val a = s.alarms.firstOrNull { it.id == s.lastAlarmId } ?: return Turn(s.copy(snoozeAt = null)); return Turn(s.copy(ringing = a, snoozeAt = null, pending = null), note = "미룬 알람이 다시 울려요.") }
        }
        for (a in s.alarms) {
            val at = a.next(n.minusMinutes(2)) ?: continue  // 울릴 시각이 막 지났으면(2분 안) 울린다
            if (!at.isAfter(n)) {
                val fired = a.copy(lastFired = at)
                return Turn(s.copy(ringing = fired, lastAlarmId = a.id, alarms = s.alarms.map { if (it.id == a.id) fired else it }, pending = null, question = null),
                    note = "${label(a)} 알람이 울려요.")
            }
        }
        return null
    }

    /** 물리 버튼: 알람 중이면 종류에 따라 끄거나 문제를 내고, 아니면 null(움직임 멈춤은 보드 앱이 처리) */
    fun alarmButton(s: BedState, rnd: java.util.Random = java.util.Random()): Turn? {
        val a = s.ringing ?: return null
        return when (a.type) {
            "question" -> {
                if (s.question != null) return Turn(s, say = "${Brain.sino(s.question.first)} 더하기 ${Brain.sino(s.question.second)}는 얼마예요?")
                val r = if (a.level == 1) 1..9 else 10..99
                val q = (r.first + rnd.nextInt(r.last - r.first + 1)) to (r.first + rnd.nextInt(r.last - r.first + 1))
                Turn(s.copy(question = q), say = "${Brain.sino(q.first)} 더하기 ${Brain.sino(q.second)}는 얼마예요?", note = "답을 맞히면 알람이 꺼져요.")
            }
            "leave_bed" -> Turn(s, say = "침대에서 나오면 알람이 꺼져요", note = "버튼으로 잠깐 소리를 멈췄어요. 침대가 비어야 꺼져요.")
            else -> Turn(s.copy(ringing = null), say = "좋은 아침이에요 알람을 끌게요")
        }
    }

    /** 압력 센서: 침대가 비었다 */
    fun bedEmpty(s: BedState): Turn? =
        if (s.ringing?.type == "leave_bed") Turn(s.copy(ringing = null), say = "좋은 아침이에요 알람을 끌게요") else null

    // ---------- 시각·말 만들기 ----------
    private fun hhmm(t: String) = t.take(2).toInt() * 60 + t.takeLast(2).toInt()

    /** 지금부터 몇 분 뒤인지. 정해진 시각이면 다음에 오는 그 시각까지 */
    private fun minutesFrom(c: Command): Int? {
        val t = c["time"]; if (t == "none") return null
        if (c["time_type"] == "relative") return hhmm(t)
        // 11/11 보드 시험: 보드 시계는 GMT라 기기 기본 시간대로 세면 9시간 어긋난다. 알람처럼 한국 시간으로 센다
        val now = now()
        var h = t.take(2).toInt(); val m = t.takeLast(2).toInt()
        if (c["ampm"] == "pm" && h < 12) h += 12
        if (c["ampm"] == "am" && h == 12) h = 0
        val nowMin = now.hour * 60 + now.minute
        var d = h * 60 + m - nowMin
        if (c["ampm"] == "none" && d <= 0 && h < 12) d += 12 * 60 // 오전·오후를 말하지 않으면 가까운 쪽
        while (d <= 0) d += 24 * 60
        if (c["date"] == "tomorrow" && d < 12 * 60) d += 24 * 60
        return d
    }
    private fun timeLabel(c: Command, mins: Int) = if (c["time_type"] == "relative") "${duration(mins)} 뒤" else clockKo(c["time"])

    companion object {
        // 모델 입력 [상태]에 들어가는 값. 학습 자료와 글자 하나까지 같아야 한다
        const val STATUS_RINGING = "알람 울리는 중"
        const val STATUS_MOVING = "침대 움직이는 중"
        const val STATUS_NONE = "없음"
        private val NATIVE = listOf("", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두")
        /** 개수 읽기: 4 → 네, 10 → 열, 20 → 스무, 23 → 스물세 */
        fun countKo(n: Int): String {
            if (n <= 0 || n >= 100) return sino(n)
            val ones = listOf("", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉")
            val tens = listOf("", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔")
            return if (n == 20) "스무" else tens[n / 10] + ones[n % 10]
        }
        private val SINO = listOf("", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구")
        // 0~9999 한자어 수. 자리 앞 일은 생략(백, 천). 11/03: 100 이상에서 배열 밖 오류로 멈추던 것 고침
        fun sino(n: Int): String {
            if (n == 0) return "영"
            val m = n.coerceIn(0, 9999)
            val sb = StringBuilder()
            for ((u, name) in listOf(1000 to "천", 100 to "백", 10 to "십")) { val d = m / u % 10; if (d > 0) sb.append(if (d > 1) SINO[d] else "").append(name) }
            return sb.append(SINO[m % 10]).toString()
        }

        // 수 뒤에 붙는 조사·말끝. 이것만 붙은 낱말을 수로 본다("오늘", "이번", "일곱"의 '일'처럼 수 글자로 시작하는 다른 낱말은 뺀다)
        private val NUM_TAIL = Regex("(이|가|은|는|을|를|도|만|요|야|에요|예요|입니다|이에요|이야|이요|이라고|라고|이고|고|이고요|고요|이면|면|이네요|네요|이네|네|이지|지|이죠|죠|이니까|니까|으로|로|에서|에|이랑|랑|하고|이거든|거든|인데|이라|라|이다|다)?")
        private val DIGIT = mapOf('영' to 0, '공' to 0, '일' to 1, '이' to 2, '삼' to 3, '사' to 4, '오' to 5, '육' to 6, '칠' to 7, '팔' to 8, '구' to 9)
        private val UNIT = mapOf('십' to 10, '백' to 100, '천' to 1000)
        private val TENS = mapOf("열" to 10, "스물" to 20, "스무" to 20, "서른" to 30, "마흔" to 40, "쉰" to 50, "예순" to 60, "일흔" to 70, "여든" to 80, "아흔" to 90)
        private val ONES = mapOf("하나" to 1, "한" to 1, "둘" to 2, "두" to 2, "셋" to 3, "세" to 3, "넷" to 4, "네" to 4, "다섯" to 5, "여섯" to 6, "일곱" to 7, "여덟" to 8, "아홉" to 9)
        /** 자리 규칙에 맞는 한자어 수만 읽는다(숫자 글자 두 개가 붙거나 자리가 거꾸로면 null) */
        private val UNKNOWN_DAY = Regex("어제|그제|그저께|엊그제|모레|글피|이번 ?주|다음 ?주|지난 ?주|주말|요일|[일이삼사오육칠팔구십]+ ?월 ?[일이삼사오육칠팔구십]+ ?일")
        private val ANGLE_RUN = Regex("[일이삼사오육칠팔구십]+")
        /** 들은 글에서 각도 수 두 개를 다시 읽는다. 십이 들어 있거나 바로 뒤에 "도"가 오는 수 덩어리만 보고,
         *  붙어 있는 덩어리("사십삼십")는 나눌 수 있는 방법을 모두 만든다. 모델 값이 그중 하나면 그대로, 아니면 가장 가까운 것.
         *  읽을 수 없으면 null(모델 값을 쓴다) */
        fun anglePair(heard: String, h: Int, l: Int): Pair<Int, Int>? {
            val runs = ANGLE_RUN.findAll(heard).filter { m -> '십' in m.value || heard.substring(m.range.last + 1).trimStart().startsWith("도") }.map { it.value }.toList()
            if (runs.isEmpty()) return null
            fun splits(w: String): List<List<Int>> {
                if (w.isEmpty()) return listOf(emptyList())
                val out = mutableListOf<List<Int>>()
                for (i in 1..w.length) { val v = sinoValue(w.take(i)) ?: continue; if (v > 90) continue; for (r in splits(w.drop(i))) out += listOf(v) + r }
                return out
            }
            var all = listOf(emptyList<Int>())
            for (w in runs) all = all.flatMap { a -> splits(w).map { a + it } }.filter { it.size <= 2 }
            val pairs = all.filter { it.size == 2 }.map { it[0] to it[1] }.distinct()
            if (pairs.isEmpty() || (h to l) in pairs) return null
            return pairs.minByOrNull { kotlin.math.abs(it.first - h) + kotlin.math.abs(it.second - l) }
        }
        private fun sinoValue(w: String): Int? {
            var total = 0; var d = -1; var last = 10000
            for (ch in w) {
                val u = UNIT[ch]
                if (u != null) { if (u >= last) return null; total += (if (d > 0) d else 1) * u; d = -1; last = u }
                else { if (d >= 0) return null; d = DIGIT[ch] ?: return null }
            }
            return total + maxOf(d, 0)
        }
        /** 사용자가 마지막에 답으로 말한 수(11/03). 앞에서 말하고 고친 수는 버린다("육십 아니 육십이입니다" → 62).
         *  십·백·천 뒤 끝 '이'가 숫자 2인지 말끝인지 모르면 두 값을 돌려준다("육십이요" → 60, 62). 수가 없으면 빈 목록 */
        fun finalAnswer(t: String): List<Int> {
            var ans = emptyList<Int>()
            for (w in t.split(' ').filter { it.isNotEmpty() }) {
                var got: List<Int>? = null
                val m = Regex("^[영공일이삼사오육칠팔구십백천]+").find(w)
                if (m != null) {
                    val tok = m.value; val rest = w.substring(tok.length)
                    if (tok.length >= 2 && tok.last() == '이') {
                        val head = tok.dropLast(1); val v0 = sinoValue(head)
                        if (head.last() in "십백천" && v0 != null) got = when {
                            rest.isEmpty() || rest.startsWith("입") || rest.startsWith("예") -> listOfNotNull(sinoValue(tok))   // 육십이, 육십이입니다, 육십이예요
                            NUM_TAIL.matches(rest) -> listOfNotNull(v0, sinoValue(tok))                                     // 육십이요, 육십이야: 애매
                            else -> null
                        } else if (v0 != null && NUM_TAIL.matches("이$rest")) got = listOf(v0)                          // 칠이, 삼십삼이, 영이네요: 끝 '이'는 조사
                    }
                    if (got == null) { val v = sinoValue(tok); if (v != null && NUM_TAIL.matches(rest)) got = listOf(v) }
                }
                if (got == null) {
                    val n = Regex("^(열|스물|스무|서른|마흔|쉰|예순|일흔|여든|아흔)?(하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|한|두|세|네)?").find(w)!!
                    val (a, b) = n.destructured
                    if (n.value.isNotEmpty() && !(a.isEmpty() && b in setOf("한", "두", "세", "네")) && NUM_TAIL.matches(w.substring(n.value.length)))
                        got = listOf((TENS[a] ?: 0) + (ONES[b] ?: 0))
                }
                if (!got.isNullOrEmpty()) ans = got.distinct()
            }
            return ans
        }
        private val HOUR_NATIVE = mapOf("한" to 1, "두" to 2, "세" to 3, "네" to 4, "다섯" to 5, "여섯" to 6, "일곱" to 7, "여덟" to 8, "아홉" to 9, "열" to 10, "열한" to 11, "열두" to 12)
        private val TIME_BEFORE = Regex("^(?:(오전|오후) )?(열한|열두|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열) ?시(?: ?(반|[일이삼사오십]+ ?분))? ?([일이삼사오육칠팔구십]+) ?분 ?전[이요야에]*$")
        private val OTHER_PART = Regex("아침|저녁|밤|새벽|낮|정오|자정|점심")
        /** 11/10 B8: 들은 말 전체가 "(오전·오후) N시 (M분·반) K분 전(이요)"일 때만 계산한 시각 대답 값. 맥 numfix.fix_time_before와 같다 */
        fun timeBefore(heard: String): String? {
            val u = heard.replace(Regex("[.,?!]"), "").trim()
            if (OTHER_PART.containsMatchIn(u)) return null
            val t = TIME_BEFORE.matchEntire(u) ?: return null
            val ap = t.groupValues[1]; val h = HOUR_NATIVE.getValue(t.groupValues[2]); val g3 = t.groupValues[3]
            val m0 = if (g3.isEmpty()) 0 else if (g3 == "반") 30 else sinoValue(g3.replace("분", "").trim()) ?: return null
            val k = sinoValue(t.groupValues[4]) ?: return null
            if (k !in 1..59 || m0 >= 60) return null
            return if (ap.isNotEmpty()) {
                val tt = ((h % 12 + if (ap == "오후") 12 else 0) * 60 + m0 - k).mod(1440)
                val hh = tt / 60; val mm = tt % 60
                "${if (hh < 12) "am" else "pm"}_%02d:%02d".format(if (hh % 12 == 0) 12 else hh % 12, mm)
            } else {
                val tt = (h % 12 * 60 + m0 - k).mod(720); val hh = tt / 60
                "%02d:%02d".format(if (hh == 0) 12 else hh, tt % 60)
            }
        }
        fun duration(mins: Int): String { val h = mins / 60; val m = mins % 60; return listOfNotNull(if (h > 0) "${NATIVE.getOrElse(h) { sino(h) }} 시간" else null, if (m > 0) "${sino(m)} 분" else null).joinToString(" ") }
        fun clockKo(t: String): String { val h = t.take(2).toInt(); val m = t.takeLast(2).toInt(); val hh = if (h % 12 == 0) 12 else h % 12; return "${NATIVE[hh]} 시" + if (m == 30) " 반" else if (m > 0) " ${sino(m)} 분" else "" }
        fun dayKo(d: String) = mapOf("today" to "오늘", "tomorrow" to "내일", "+2" to "모레")[d] ?: ""
        /** 폰에서 건 예약의 이름: 말로 건 예약과 같은 한글 시각("오후 일곱 시 사십 분"), 내일이면 앞에 "내일" */
        fun resvLabel(at: java.time.LocalDateTime, today: java.time.LocalDate): String =
            (if (at.toLocalDate().isAfter(today)) "내일 " else "") + (if (at.hour < 12) "오전 " else "오후 ") + clockKo("%02d:%02d".format(at.hour, at.minute))
        fun ampmKo(a: String) = mapOf("am" to "오전", "pm" to "오후", "dawn" to "새벽", "morning" to "아침")[a] ?: ""
        fun typeKo(t: String) = mapOf("basic" to "기본", "leave_bed" to "침대에서 나와야 꺼지는", "question" to "문제를 풀어야 꺼지는")[t] ?: "기본"
        /** 검사를 이미 통과한 출력을 다시 읽는다(물어 둔 일을 실행할 때) */
        const val RECENT_MS = 10_000L
        // 11/11: 지금 상태를 말하는 끝맺음(낮아, 떠 있어 등)과 움직이라는 말
        val COMPLAINT_END = Regex("(?:(?:낮|높)(?:아|네|아요|네요|은 것 같아|은 거 같아|은 것 같은데|은 거 같은데|은 듯해|은 편이네)|(?:떠|서|누워|처져|들려|솟아|내려가|올라가|세워져|눕혀져) ?있(?:어|네|어요|네요|는 것 같아|는 거 같아))$")
        val MOVE_VERB = Regex("(?:올려|내려|낮춰|높여|세워|눕혀|맞춰|돌려)(?= ?(?:줘|주|봐|놔|둬|라|요|$))|해 ?(?:줘|주)|(?:하|리|추|이|우|히)자(?:$| )")
        fun parseKv(out: String): Command {
            val tok = out.substring(1, out.indexOf('>'))
            val body = out.substring(out.indexOf('(') + 1, out.lastIndexOf(')'))
            val kv = LinkedHashMap<String, String>()
            if (body.isNotEmpty()) for (p in body.split(", ")) { val (k, v) = p.split("=", limit = 2); kv[k] = v }
            val cmd = kv.remove("command")
            return Command(tok, cmd, kv)
        }
    }
}
