package com.jaljayo.board.model

// 모델에 넣는 입력 문장을 만든다. 학습 때와 같은 모양이어야 한다
enum class PromptFormat {
    QUERY_ONLY,     // 옛 모델: "... Query: {문장} Response:"
    WITH_QUESTION,  // 앞 질문 모델: "... Query: [앞 질문] {질문 또는 없음} [말] {문장} Response:"
    WITH_STATUS,    // 새 모델: "... Query: [상태] {상태} [앞 질문] {질문 또는 없음} [말] {문장} Response:"
}

object Prompt {
    /** 지금 쓰는 모델의 입력 모양. 옛 모델을 쓸 때만 QUERY_ONLY 또는 WITH_QUESTION으로 바꾼다 */
    val FORMAT = PromptFormat.WITH_STATUS

    // 학습 때와 같은 입력 모양. 선배 앱처럼 앞에 <|im_start|>를 붙이지 않는다
    const val HEAD = "Below is the query from the users, please choose the correct function and generate the parameters to call the function. Query: "
    const val NO_QUESTION = "없음"
    const val NO_STATUS = "없음"

    /** text: 들은 말, asked: 지금 대답을 기다리는 질문(두뇌가 실제로 말한 문장), 없으면 null,
     *  status: 보드 상태(Brain.status 값: "알람 울리는 중", "침대 움직이는 중", "없음"), 없으면 "없음" */
    fun build(text: String, asked: String?, status: String? = null, format: PromptFormat = FORMAT): String {
        val q = asked?.trim()?.takeIf { it.isNotEmpty() } ?: NO_QUESTION
        val st = status?.trim()?.takeIf { it.isNotEmpty() } ?: NO_STATUS
        return when (format) {
            PromptFormat.QUERY_ONLY -> "$HEAD$text Response:"
            PromptFormat.WITH_QUESTION -> "$HEAD[앞 질문] $q [말] $text Response:"
            PromptFormat.WITH_STATUS -> "$HEAD[상태] $st [앞 질문] $q [말] $text Response:"
        }
    }
}
