package com.jaljayo.board.net

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

// 11/19 병원 침대 QR. 글은 jaljayo://bed/<고유 번호> 하나뿐입니다(hospital-beds.md).
// 안드로이드 화면과 맥 시험(PNG 만들기)이 같은 칸 배열을 쓰도록 그림 없이 칸(검은 칸 true)만 만듭니다.
object BedQr {
    /** 검은 칸이면 true. 바깥 여백(quiet)은 칸 수로 넣습니다 */
    fun cells(text: String, quiet: Int = 2): Array<BooleanArray> {
        val hints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to quiet, EncodeHintType.CHARACTER_SET to "UTF-8")
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints)
        return Array(m.height) { y -> BooleanArray(m.width) { x -> m.get(x, y) } }
    }
}
