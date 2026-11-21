package com.jaljayo.board

import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.jaljayo.board.net.BedQr
import com.jaljayo.board.net.HospitalBeds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.util.zip.CRC32
import java.util.zip.DeflaterOutputStream

// 11/19: 보드 화면의 침대 QR(jaljayo://bed/<id>)이 다시 읽히는지 보고, 맥에서 보여 줄 PNG를 만든다.
// PNG(파일 이름이 고유 번호)는 환경 변수가 있을 때만 만든다. 보드 고유 번호는 그 보드의 안드로이드 기기 번호로 정해지므로 둘 중 하나를 넣는다.
//   JALJAYO_BOARD_ID=B7Q2 (보드 화면·기록의 "보드 고유 번호") 또는 JALJAYO_ANDROID_ID=<adb shell settings get secure android_id>
//   JALJAYO_QR_OUT=저장 폴더(없으면 ~/aihub/tts_train_1118/board_int/qr), JALJAYO_QR_SLOTS=칸 수(없으면 3)
class BedQrTest {
    private fun pixels(text: String, k: Int): Pair<Int, IntArray> {
        val cells = BedQr.cells(text)
        val w = cells.size * k
        return w to IntArray(w * w) { i -> if (cells[(i / w) / k][(i % w) / k]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
    }

    private fun read(text: String): String {
        val (w, px) = pixels(text, 6)
        return QRCodeReader().decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(w, w, px)))).text
    }

    /** 흑백 PNG(회색조 8비트). 시험 환경에는 그림 라이브러리(java.awt)가 없어 직접 적는다 */
    private fun png(w: Int, px: IntArray): ByteArray {
        val raw = ByteArrayOutputStream()
        DeflaterOutputStream(raw).use { z -> for (y in 0 until w) { z.write(0); for (x in 0 until w) z.write(if (px[y * w + x] == 0xFF000000.toInt()) 0 else 255) } }
        val o = ByteArrayOutputStream(); val d = DataOutputStream(o)
        fun chunk(type: String, data: ByteArray) {
            d.writeInt(data.size); val t = type.toByteArray(); d.write(t); d.write(data)
            val c = CRC32(); c.update(t); c.update(data); d.writeInt(c.value.toInt())
        }
        d.write(byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 13, 10, 26, 10))
        val ih = ByteArrayOutputStream(); DataOutputStream(ih).apply { writeInt(w); writeInt(w); write(byteArrayOf(8, 0, 0, 0, 0)) }
        chunk("IHDR", ih.toByteArray()); chunk("IDAT", raw.toByteArray()); chunk("IEND", ByteArray(0))
        return o.toByteArray()
    }

    @Test fun qrReadsBack() {
        for (id in listOf("B7Q2-1", "ABCD-2", HospitalBeds.boardId("9774d56d682e549c") + "-3")) {
            val t = HospitalBeds.qrText(id)
            assertEquals("jaljayo://bed/$id", t)
            assertEquals(t, read(t))
            assertEquals(id, HospitalBeds.idOfQr(read(t)))
        }
    }

    @Test fun writePngsWhenAsked() {
        val env = System.getenv()
        val board = env["JALJAYO_BOARD_ID"]?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
            ?: env["JALJAYO_ANDROID_ID"]?.trim()?.takeIf { it.isNotEmpty() }?.let { HospitalBeds.boardId(it) }
            ?: return
        val out = File(env["JALJAYO_QR_OUT"] ?: "build/qr").also { it.mkdirs() }
        val n = env["JALJAYO_QR_SLOTS"]?.toIntOrNull() ?: 3
        for (i in 1..n) {
            val id = "$board-$i"
            val (w, px) = pixels(HospitalBeds.qrText(id), 16)
            val f = File(out, "$id.png")
            f.writeBytes(png(w, px))
            assertTrue(f.length() > 0)
            println("QR PNG: ${f.path}")
        }
    }

    // 11/19: QR에 보드 주소를 함께 담는다. 다시 읽혀야 하고, 보드는 ? 뒤와 손 입력의 @ 뒤를 무시하고 고유 번호만 꺼낸다
    @Test fun qrWithHostReadsBackAndIdIgnoresHost() {
        val t = HospitalBeds.qrText("9CTF-1", "192.168.1.2:8765")
        assertEquals("jaljayo://bed/9CTF-1?h=192.168.1.2:8765", t)
        assertEquals(t, read(t))
        assertEquals("9CTF-1", HospitalBeds.idOfQr(t))
        assertEquals("9CTF-1", HospitalBeds.idOfQr("9ctf-1@192.168.1.2"))
        assertEquals("9CTF-1", HospitalBeds.idOfQr("jaljayo://bed/9CTF-1"))
        assertEquals("9CTF-1@192.168.1.2", HospitalBeds.typedText("9CTF-1", "192.168.1.2:8765"))
        assertEquals("9CTF-1@192.168.1.2:9000", HospitalBeds.typedText("9CTF-1", "192.168.1.2:9000"))
        assertEquals("jaljayo://bed/9CTF-1", HospitalBeds.qrText("9CTF-1"))
    }
}
