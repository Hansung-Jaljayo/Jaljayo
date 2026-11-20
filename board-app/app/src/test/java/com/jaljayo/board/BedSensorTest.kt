package com.jaljayo.board

import com.jaljayo.board.brain.BedSensor
import org.junit.Assert.*
import org.junit.Test

class BedSensorTest {
    /** 0.2초마다 같은 값을 보내며 0.05초마다 판정한다. 빈 것으로 판정된 시각(없으면 null) */
    private fun run(s: BedSensor, from: Long, to: Long, occupied: Boolean?, counting: Boolean = true): Long? {
        var t = from
        while (t <= to) {
            if (occupied != null && (t - from) % 200 == 0L) s.report(occupied, if (occupied) 700 else 20, false, t)
            if (s.check(counting, t)) return t
            t += 50
        }
        return null
    }

    @Test fun emptyForThreeSecondsEndsIt() {
        val s = BedSensor()
        assertNull(run(s, 0, 2000, true))
        assertEquals(5000L, run(s, 2000, 9000, false))
    }

    @Test fun briefLiftStartsOver() {
        val s = BedSensor()
        assertNull(run(s, 0, 2000, false))            // 2초 비었다가
        assertNull(run(s, 2000, 2400, true))          // 다시 눌림
        assertNull(s.emptyMs(2400))
        assertEquals(5400L, run(s, 2400, 9000, false)) // 다시 3초를 채워야 한다
    }

    @Test fun notCountedWhileAlarmIsNotRinging() {
        val s = BedSensor()
        assertNull(run(s, 0, 10000, false, counting = false))
        assertNull(s.emptyMs(10000))
        assertEquals(13000L, run(s, 10000, 20000, false)) // 울리기 전부터 비어 있어도 울린 뒤 3초
    }

    @Test fun lostSensorDoesNotEndIt() {
        val s = BedSensor()
        assertNull(run(s, 0, 2000, false))   // 2초 비었다가
        assertNull(run(s, 2050, 9000, null)) // 소식이 끊김
        assertNull(s.occupied); assertNull(s.emptyMs(9000))
        assertEquals(12000L, run(s, 9000, 20000, false)) // 다시 오면 처음부터
    }

    @Test fun occupiedNeverEndsIt() {
        val s = BedSensor()
        assertNull(run(s, 0, 20000, true))
        assertEquals(true, s.occupied); assertEquals(700, s.value)
    }
}
