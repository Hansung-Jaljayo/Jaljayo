package com.jaljayo.board.net

import org.json.JSONObject

/**
 * 11/19 침대 버튼·압력 센서 나노(firmware/bed_io/bed_io.ino)가 USB로 보내는 한 줄을 보드가 이미 받는 글로 바꿉니다.
 * 시연 화면이 WebSocket으로 보내던 `{type:"button"}`·`{type:"sensor"}`와 똑같은 모양으로 만들어 같은 처리(BoardService.onPc)를 거치게 합니다.
 * - `BTN SHORT` → `{type:"button"}`
 * - `BTN LONG`  → `{type:"button", long:true}`
 * - `FSR 값`    → `{type:"sensor", occupied: 값 > FSR_THRESHOLD, value: 값, virtual:false}` (FSR_ENABLED일 때만)
 * - `READY` 등 나머지 줄은 보낼 글이 없습니다(null)
 * 병원 모드면 bed(이 보드에 실제로 붙은 침대 이름)를 함께 넣고, 가정용이면 넣지 않습니다.
 */
object NanoLines {
    /** 11/19 압력 센서(FSR406, A0와 GND 사이 10K옴)를 연결해 값이 안정된 것을 확인했습니다(안 누름 0, 손으로 누름 약 1017) */
    const val FSR_ENABLED = true
    /** 이 값보다 크게 눌리면 누워 있다고 봅니다. 11/19 잰 값: 비었을 때·지우개만 올렸을 때 0, 손으로 누를 때 약 1017. 시연(손으로 누르기)에 맞춰 200으로 둡니다.
     *  실제 매트리스 밑에 깔 때는 누웠을 때와 비었을 때 값을 다시 재어 맞춰야 합니다 */
    const val FSR_THRESHOLD = 200
    /** 병원 모드에서 이 보드에 실제로 꽂힌 침대. 지금은 시연 화면·폰이 쓰는 첫 침대(사과)로 둡니다. 맡은 침대에 없으면 맡은 침대 중 첫 번째를 씁니다 */
    const val NANO_BED = "사과"
    /** 이보다 긴 줄은 잡음으로 보고 버립니다 */
    const val MAX_LINE = 64

    /** 병원 모드에서 나노 글에 붙일 침대. 가정용이면 null */
    fun bedFor(ward: Boolean, wardList: List<String>): String? =
        if (!ward) null else if (NANO_BED in wardList || wardList.isEmpty()) NANO_BED else wardList.first()

    /** 한 줄을 보드가 받는 글로. 보낼 것이 없으면 null */
    fun toMessage(line: String, bed: String?, fsrEnabled: Boolean = FSR_ENABLED, threshold: Int = FSR_THRESHOLD): JSONObject? {
        val t = line.trim()
        val m = when {
            t == "BTN SHORT" -> JSONObject().put("type", "button")
            t == "BTN LONG" -> JSONObject().put("type", "button").put("long", true)
            t.startsWith("FSR ") && fsrEnabled -> {
                val v = t.substring(4).trim().toIntOrNull()?.takeIf { it in 0..1023 } ?: return null
                JSONObject().put("type", "sensor").put("occupied", v > threshold).put("value", v).put("virtual", false)
            }
            else -> return null
        }
        if (bed != null) m.put("bed", bed)
        return m
    }

    /** USB로 조각조각 들어오는 바이트를 줄로 모읍니다. 줄 끝은 \n이고 \r은 지웁니다 */
    class Buffer {
        private val sb = StringBuilder()
        private var dropping = false

        fun feed(bytes: ByteArray, len: Int = bytes.size): List<String> {
            val out = ArrayList<String>()
            for (i in 0 until len) {
                val c = (bytes[i].toInt() and 0xff).toChar()
                when {
                    c == '\n' -> { if (!dropping) sb.toString().trim().takeIf { it.isNotEmpty() }?.let { out.add(it) }; sb.setLength(0); dropping = false }
                    c == '\r' -> {}
                    dropping -> {}
                    sb.length >= MAX_LINE -> { sb.setLength(0); dropping = true }   // 줄 끝 없이 너무 길면 다음 줄 끝까지 버립니다
                    else -> sb.append(c)
                }
            }
            return out
        }
    }
}
