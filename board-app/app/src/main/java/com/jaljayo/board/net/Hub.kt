package com.jaljayo.board.net

import android.util.Log
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress

// 같은 공유기 안 PC(시연 화면·언리얼)·폰과 주고받는 창구. 선배 앱처럼 8765번 WebSocket. 새 형식은 docs/interfaces/board-link.md
// 보내는 것: 상태(각도·예약·알람), 한 번의 대화(들은 말·모델 출력·대답·걸린 시간)
// 받는 것: 시험용 글자 입력, 버튼, 압력 센서, 시각 맞추기, 부르는 말 없이 듣기 켜고 끄기
class Hub(port: Int, private val onMessage: (JSONObject, WebSocket) -> Unit, private val onLeft: (WebSocket) -> Unit = {}) : WebSocketServer(InetSocketAddress("0.0.0.0", port)) {
    @Volatile var lastState: String = "{}"

    init { isReuseAddr = true }

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        Log.i(TAG, "PC 연결: ${conn.remoteSocketAddress}")
        conn.send(lastState)
    }
    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) { Log.i(TAG, "PC 연결 끊김"); onLeft(conn) }
    override fun onMessage(conn: WebSocket, message: String) {
        try { onMessage(JSONObject(message), conn) } catch (e: Exception) { Log.w(TAG, "받은 글 해석 실패: $message", e) }
    }
    override fun onError(conn: WebSocket?, ex: Exception) { Log.w(TAG, "연결 오류", ex) }
    override fun onStart() { Log.i(TAG, "PC 연결 대기: $port") }

    fun send(o: JSONObject) {
        val s = o.toString()
        if (o.optString("type") == "state") lastState = s
        try { broadcast(s) } catch (e: Exception) { Log.w(TAG, "보내기 실패", e) }
    }

    /** 한 접속에만 보낸다 */
    fun sendTo(c: WebSocket, o: JSONObject) {
        try { if (c.isOpen) c.send(o.toString()) } catch (e: Exception) { Log.w(TAG, "보내기 실패", e) }
    }

    companion object { const val TAG = "JaljayoHub" }
}
