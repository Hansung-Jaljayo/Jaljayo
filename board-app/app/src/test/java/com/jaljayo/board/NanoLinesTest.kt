package com.jaljayo.board

import com.jaljayo.board.net.NanoLines
import org.junit.Assert.*
import org.junit.Test

/** 11/19 나노 USB 줄 → 보드 글(button·sensor). 시연 화면·맥 중계(nano_bridge.py)가 보내던 모양과 같아야 한다 */
class NanoLinesTest {
    @Test fun shortPress() {
        val m = NanoLines.toMessage("BTN SHORT", null)!!
        assertEquals("button", m.getString("type"))
        assertFalse(m.optBoolean("long"))
        assertFalse(m.has("bed"))   // 가정용은 bed 없음
    }

    @Test fun longPressWithBed() {
        val m = NanoLines.toMessage("BTN LONG", "사과")!!
        assertEquals("button", m.getString("type"))
        assertTrue(m.getBoolean("long"))
        assertEquals("사과", m.getString("bed"))
    }

    @Test fun fsrOffWhenDisabled() {
        // 11/19 센서를 연결해 기본값을 켰습니다. 꺼 두면 압력 값을 보내지 않는지만 봅니다
        assertNull(NanoLines.toMessage("FSR 800", null, fsrEnabled = false))
    }

    @Test fun fsrWhenEnabled() {
        val on = NanoLines.toMessage("FSR 800", "사과", fsrEnabled = true)!!
        assertEquals("sensor", on.getString("type"))
        assertTrue(on.getBoolean("occupied"))
        assertEquals(800, on.getInt("value"))
        assertFalse(on.getBoolean("virtual"))
        assertEquals("사과", on.getString("bed"))
        val off = NanoLines.toMessage("FSR 42", null, fsrEnabled = true)!!
        assertFalse(off.getBoolean("occupied"))
        // 기준값과 같으면 아직 누운 것이 아니다(nano_bridge.py와 같이 "보다 클 때")
        assertFalse(NanoLines.toMessage("FSR ${NanoLines.FSR_THRESHOLD}", null, fsrEnabled = true)!!.getBoolean("occupied"))
        assertTrue(NanoLines.toMessage("FSR ${NanoLines.FSR_THRESHOLD + 1}", null, fsrEnabled = true)!!.getBoolean("occupied"))
    }

    @Test fun badFsrIgnored() {
        for (l in listOf("FSR", "FSR ", "FSR abc", "FSR -1", "FSR 1024", "FSR 12 34")) assertNull(l, NanoLines.toMessage(l, null, fsrEnabled = true))
    }

    @Test fun otherLinesIgnored() {
        for (l in listOf("READY", "", "BTN", "BTN short", "btn SHORT", "BTN SHORTX", "hello")) assertNull(l, NanoLines.toMessage(l, null, fsrEnabled = true))
        assertNotNull(NanoLines.toMessage("  BTN SHORT \r", null))   // 앞뒤 빈칸·\r은 지운다
    }

    @Test fun bedChoice() {
        assertNull(NanoLines.bedFor(false, listOf("사과", "포도")))
        assertEquals("사과", NanoLines.bedFor(true, listOf("사과", "포도", "딸기")))
        assertEquals("포도", NanoLines.bedFor(true, listOf("포도")))   // 사과를 맡지 않은 보드면 맡은 첫 침대
    }

    @Test fun bufferSplitsChunks() {
        val b = NanoLines.Buffer()
        assertEquals(emptyList<String>(), b.feed("REA".toByteArray()))
        assertEquals(listOf("READY"), b.feed("DY\r\nBTN S".toByteArray()))
        assertEquals(listOf("BTN SHORT", "FSR 12"), b.feed("HORT\r\nFSR 12\n\n".toByteArray()))
    }

    @Test fun bufferUsesLength() {
        val b = NanoLines.Buffer()
        val buf = ByteArray(32); "BTN LONG\nxxxx".toByteArray().copyInto(buf)
        assertEquals(listOf("BTN LONG"), b.feed(buf, 9))
    }

    @Test fun bufferDropsOverlongGarbage() {
        val b = NanoLines.Buffer()
        assertEquals(emptyList<String>(), b.feed(ByteArray(200) { 'x'.code.toByte() }))
        assertEquals(emptyList<String>(), b.feed("yyy\n".toByteArray()))   // 너무 긴 줄의 끝까지 버린다
        assertEquals(listOf("BTN SHORT"), b.feed("BTN SHORT\n".toByteArray()))
    }
}
