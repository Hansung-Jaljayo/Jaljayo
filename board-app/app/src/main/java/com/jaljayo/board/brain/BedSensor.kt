package com.jaljayo.board.brain

/**
 * 압력 센서 판정. 침대 이탈 알람이 울리는 동안 "비었음"이 3초 이어져야 침대가 빈 것으로 본다.
 * - 잠깐 들썩인 것: 눌림이 다시 오면 처음부터 다시 센다.
 * - 센서 끊김: 1초 넘게 소식이 없으면 모르는 것으로 보고 세지 않는다(끊겼다고 알람을 끄지 않는다).
 * - 알람이 울리지 않을 때는 세지 않는다. 울리기 전부터 비어 있었어도 울린 뒤 3초를 채워야 꺼진다.
 */
class BedSensor(val needMs: Long = 3000, private val staleMs: Long = 1000) {
    /** 마지막으로 들은 값. 들은 적이 없거나 소식이 끊기면 null */
    var occupied: Boolean? = null; private set
    /** 센서가 보낸 눌림 값(0~1023). 화면에 보여 주는 용도이고 판정에는 쓰지 않는다 */
    var value: Int? = null; private set
    /** 키보드로 넣은 가상 값인지 */
    var virtual = false; private set
    private var lastAt = 0L
    private var emptySince: Long? = null

    fun report(occupied: Boolean, value: Int?, virtual: Boolean, now: Long) {
        this.occupied = occupied; this.value = value; this.virtual = virtual; lastAt = now
        if (occupied) emptySince = null
    }

    /** 주기마다 부른다. counting은 침대 이탈 알람이 울리는 중인지. 비었음이 needMs 동안 이어졌으면 true */
    fun check(counting: Boolean, now: Long): Boolean {
        if (occupied != null && now - lastAt > staleMs) { occupied = null; value = null }
        if (!counting || occupied != false) { emptySince = null; return false }
        val since = emptySince ?: now.also { emptySince = it }
        return lastAt - since >= needMs   // 센서가 실제로 알려 온 시각까지만 센다(소식이 끊긴 동안은 세지 않는다)
    }

    /** 비었음을 세기 시작한 뒤 흐른 시간. 세는 중이 아니면 null */
    fun emptyMs(now: Long): Long? = emptySince?.let { now - it }
}
