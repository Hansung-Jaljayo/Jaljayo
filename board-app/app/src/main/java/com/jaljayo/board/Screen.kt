package com.jaljayo.board

// 11/17 보드 화면 새 디자인: 화면에 보여 줄 값. 보드 앱(BoardService)이 한 줄(main)에서 만들어 두고, 화면은 읽기만 한다

/** 지금 보드가 하는 일 */
enum class Phase { BOOT, IDLE, LISTEN, HEAR, THINK, SPEAK, RING }

// callable: 11/19 병원용에서 이름을 불러 대답하는 침대인지(병원에 등록되고 이름이 있음)
data class BedView(val name: String, val head: Int, val leg: Int, val moving: Boolean, val active: Boolean, val callable: Boolean = true)

data class ScreenState(
    val phase: Phase = Phase.BOOT,
    val ward: Boolean = false,
    val callWord: String = "잘자요",      // 부르는 말("잘자요" 또는 "사과 침대")
    val beds: List<BedView> = emptyList(),
    val nextAlarm: String? = null,        // "내일 오전 7:00"
    val reservation: String? = null,      // "오후 11:30 · 잠 자세"
    val model: String = "",
    val clockNotice: String? = null,      // 11/17: 시각을 잃어 알람이 멈췄을 때 안내
    val qr: List<String> = emptyList(),   // 11/19: 병원에 등록되지 않은 침대의 고유 번호(화면에 QR로 보여 줌)
    val allQr: List<String> = emptyList(),   // 11/19: QR 단추로 보여 줄 QR 하나(병원용은 병실 QR = 보드 번호, 가정용은 침대 고유 번호)
    val host: String? = null,             // 11/19: 폰이 붙을 보드 주소(IP:8765). QR에 함께 담는다. 랜이 없으면 null
)

/** 한 마디: 들은 말, 모델 출력, 보드 대답(또는 설명), 걸린 시간 */
data class TalkItem(val at: Long, val heard: String, val output: String, val say: String, val note: String, val asrMs: Long, val llmMs: Long)

/** 화면에 보여 줄 대화 묶음. 오래된 것부터 지운다 */
object Talk {
    private val items = ArrayDeque<TalkItem>()
    var onAdd: ((TalkItem) -> Unit)? = null
    @Synchronized fun add(t: TalkItem) {
        items.addLast(t); while (items.size > 60) items.removeFirst()
        onAdd?.invoke(t)
    }
    @Synchronized fun all(): List<TalkItem> = items.toList()
}
