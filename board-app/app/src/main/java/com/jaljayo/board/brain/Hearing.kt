package com.jaljayo.board.brain

// 음성 인식 결과를 모델에 넣을 모양으로 다듬고, 지금 들어야 하는 말인지 정한다.
// 학습 문장은 문장부호가 없고 숫자를 "삼십 도"처럼 한글로 적었으므로 같은 모양으로 맞춘다.
object Hearing {
    // 부르는 말(설계서 6절 "언제부터 듣고"). 앞에 붙으면 떼고 나머지를 명령으로 본다
    // 11/11 보드 시험: 받아쓰기가 "잘자요"를 "살 자요"·"별자요"로 적은 적이 있어 함께 받는다
    private val WAKE = listOf("잘자요야", "잘 자요", "잘자요", "살 자요", "살자요", "별 자요", "별자요", "잘자")

    data class Heard(val text: String, val woke: Boolean)

    // 앞뒤가 영문이 아닐 때만 바꾼다(다른 영단어 속 글자는 건드리지 않음)
    private fun word(w: String) = Regex("(?i)(?<![a-z])$w(?![a-z])")
    // 받아쓰기가 "사흘"을 "4흘", "이틀"을 "2틀"로 적는다(보드 로그 11/04). 숫자 소리가 아닌 "나흘"·"열흘"은 그대로 온다
    private val DAY_WORDS = listOf(Regex("(?<!\\d)4\\s*흘") to "사흘", Regex("(?<!\\d)2\\s*틀") to "이틀")
    private val LATIN = listOf(word("t\\s*\\.?\\s*v") to "티비", word("o\\.?\\s*k(ay)?") to "오케이", word("wi-?\\s*fi") to "와이파이", word("bluetooth") to "블루투스")

    fun normalize(raw: String): String {
        var t = raw.replace(Regex("<\\|[^|]*\\|>"), " ")              // SenseVoice 꼬리표(<|ko|> 등)
        // 11/10 Q8: 한글 바로 뒤에 붙은 숫자는 띄어 쓴다("알람4흘" → "알람 4흘"). 받아쓰기가 숫자로 적은 날 수 말은 표로 되돌린다
        t = Regex("(?<=[가-힣])(?=\\d)").replace(t, " ")
        for ((re, ko) in DAY_WORDS) t = re.replace(t, ko)
        t = t.replace("모래", "모레")   // 11/11 보드 시험: 받아쓰기가 날짜 "모레"를 소리가 같은 "모래"로 적는다
        t = Regex("(\\d{1,2}):(\\d{2})").replace(t) { m -> clock(m.groupValues[1].toInt(), m.groupValues[2].toInt()) }
        t = Regex("(\\d+)\\s*시").replace(t) { m -> hours(m.groupValues[1].toInt()) + " 시" }
        // 학습 문장 모양에 맞춘다(11/03): 순번·횟수·개수는 고유어("두 번째", "한 번", "세 개"), 단위 앞은 띄움("삼십 분", "오 도")
        t = Regex("(?<=\\d),(?=\\d{3}(?!\\d))").replace(t, "")
        t = Regex("(\\d+)\\s*번째").replace(t) { m -> m.groupValues[1].toInt().let { if (it == 1) "첫" else native(it) } + " 번째" }
        t = Regex("(\\d+)\\s*(번|개)").replace(t) { m -> native(m.groupValues[1].toInt()) + " " + m.groupValues[2] }
        t = Regex("(\\d+)\\s*(분|도|일|주|초)").replace(t) { m -> Brain.sino(m.groupValues[1].toInt().coerceAtMost(9999)) + " " + m.groupValues[2] }
        t = Regex("\\d+").replace(t) { m -> Brain.sino(m.value.toInt().coerceAtMost(9999)) }
        // 영문으로 받아쓴 말 중 학습에 한글로 있는 것은 한글로 바꾼 뒤 나머지 영문을 지운다(11/03: "TV 자세"가 "자세"로 사라지던 버그)
        for ((re, ko) in LATIN) t = re.replace(t, " $ko ")
        t = t.replace(Regex("[^가-힣 ]"), " ")
        return t.replace(Regex("\\s+"), " ").trim()
    }

    /** 부르는 말만 했는지(말하는 중 끊어 들은 조각에 씀) */
    fun wakeOnly(t: String): Boolean = wake(t).let { it.woke && it.text.isEmpty() }

    /** 부르는 말을 떼어 낸다. 부르는 말만 했으면 text가 비어 있다 */
    fun wake(t: String): Heard {
        // 11/10: "잘자요"로 시작하면 뒤에 붙어 있어도("잘자요보에") 부르는 말이다. text에는 뒤에 붙은 말을 남기지만 보드는 쓰지 않는다.
        // "잘자"는 다른 말("잘자는 법")과 헷갈리지 않게 지금처럼 홀로이거나 띄어 쓸 때만
        for (w in WAKE) if (t == w || t.startsWith("$w ") || (w != "잘자" && t.startsWith(w))) return Heard(t.removePrefix(w).trim(), true)
        return Heard(t, false)
    }

    // 고유어 수(1~99). 그 밖은 한자어
    private fun native(n: Int): String {
        val ones = listOf("", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉")
        val tens = listOf("", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔")
        if (n !in 1..99) return Brain.sino(n.coerceAtMost(9999))
        if (n == 20) return "스무"
        return tens[n / 10] + ones[n % 10]
    }
    private fun hours(h: Int) =listOf("영", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두").getOrElse(h) { Brain.sino(h) }
    private fun clock(h: Int, m: Int) = hours(h) + " 시" + if (m == 0) "" else if (m == 30) " 반" else " " + Brain.sino(m) + " 분"
}
