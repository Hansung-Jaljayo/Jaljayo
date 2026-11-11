package com.jaljayo.board.net

import com.jaljayo.board.brain.Angles
import org.json.JSONObject

// 침대 역할(시연 화면, 나중에는 침대 제어부)과 주고받는 부분. 형식은 docs/interfaces/board-link.md
// 목표가 바뀌면 명령을 보내고, 침대가 돌려준 각도를 보관한다. 보관한 값은 BoardService.tick()이 한 줄에서만 읽어 쓴다
class BedLink(private val send: (JSONObject) -> Unit) {
    data class Finished(val angles: Angles, val result: String)

    private var sent: Angles? = null
    private var serial = 0
    @Volatile var latest: Angles? = null; private set
    @Volatile private var finished: Finished? = null

    /** 접속 직후: 움직이지 않고 보드가 아는 각도로 바로 맞춘다 */
    fun start(angles: Angles, target: Angles) {
        latest = angles
        sent = target
        send(cmd("bed-move", ++serial).put("head", target.head).put("leg", target.leg).put("snap", true))
    }

    /** 목표가 바뀌었으면 명령을 보낸다. 목표가 지금 각도와 같으면 멈춤이다 */
    fun sync(angles: Angles, target: Angles) {
        if (sent == target) return
        sent = target
        val c = if (target == angles) cmd("bed-stop", ++serial) else cmd("bed-move", ++serial).put("head", target.head).put("leg", target.leg)
        send(c)
    }

    /** 침대가 멈춘 자리를 목표로 받아들인다(이 값으로 다시 명령을 보내지 않게) */
    fun accept(a: Angles) { sent = a }

    fun read(m: JSONObject) {
        val a = Angles(m.getDouble("head"), m.getDouble("leg"))
        latest = a
        if (!m.isNull("result")) finished = Finished(a, m.getString("result"))
    }

    /** 끝난 결과를 한 번만 꺼낸다 */
    fun takeFinished(): Finished? = finished.also { finished = null }

    private fun cmd(type: String, id: Int) = JSONObject().put("type", type).put("id", id)
}
