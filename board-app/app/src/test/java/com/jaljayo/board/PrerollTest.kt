package com.jaljayo.board

import com.jaljayo.board.audio.Preroll
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

// 말 구간 앞 여유(11/05): 구간 바로 앞 소리를 정확히 붙이는지, 범위를 벗어나면 구간을 그대로 두는지
class PrerollTest {
    private fun ramp(from: Int, n: Int) = FloatArray(n) { (from + it).toFloat() }

    @Test fun addsExactlyTheSamplesBeforeTheSegment() {
        val p = Preroll(100); p.add(ramp(0, 60))
        val seg = ramp(40, 10)                       // 40..49
        val out = p.withPreroll(40, seg, 5)
        assertArrayEquals(ramp(35, 15), out, 0f)     // 35..49
    }

    @Test fun shortHistoryUsesWhatIsThere() {
        val p = Preroll(100); p.add(ramp(0, 20))
        assertArrayEquals(ramp(0, 13), p.withPreroll(3, ramp(3, 10), 5), 0f)
    }

    @Test fun wrapsAroundTheRing() {
        val p = Preroll(50); p.add(ramp(0, 130))      // 보관: 80..129
        assertArrayEquals(ramp(95, 25), p.withPreroll(100, ramp(100, 20), 5), 0f)
        assertArrayEquals(ramp(80, 20), p.withPreroll(90, ramp(90, 10), 30), 0f)   // 보관 범위 밖(60..79)은 버림
    }

    @Test fun badPositionKeepsSegment() {
        val p = Preroll(100); p.add(ramp(0, 30))
        val seg = ramp(0, 5)
        assertArrayEquals(seg, p.withPreroll(40, seg, 5), 0f)
        assertArrayEquals(seg, p.withPreroll(-1, seg, 5), 0f)
        p.reset(); assertEquals(0L, p.total)
        assertArrayEquals(seg, p.withPreroll(10, seg, 5), 0f)
    }
}
