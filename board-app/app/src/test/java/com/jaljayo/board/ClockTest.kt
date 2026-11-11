package com.jaljayo.board

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// 11/11: 폰이 한 번 맞춰 주면 보드가 스스로 센다. 앱 재시작에도 유지, 다시 부팅되면 인터넷 시간일 때만 믿는다
class ClockTest {
    private val f = File.createTempFile("clock", ".json").also { it.delete() }
    private val T = BoardClock.MIN_SANE + 86_400_000L
    @Test fun keepsAcrossAppRestart() {
        var sys = T; val c = BoardClock(f, { "boot1" }, { false }, { sys }); c.start(); assertFalse(c.valid)
        c.set(T + 5_000); assertTrue(c.valid)
        sys += 60_000; val c2 = BoardClock(f, { "boot1" }, { false }, { sys }); c2.start()
        assertTrue(c2.valid); assertEquals(sys + 5_000, c2.now())
    }
    @Test fun rebootNeedsNetworkTime() {
        var sys = T; val c = BoardClock(f, { "boot1" }, { true }, { sys }); c.set(T)
        sys = 1_000_000L   // 다시 부팅, 시계가 처음으로 돌아감
        val c2 = BoardClock(f, { "boot2" }, { true }, { sys }); c2.start(); assertFalse(c2.valid)
        sys = T + 10 * 60_000L   // 인터넷 시간으로 맞춰짐
        assertTrue(c2.check()); assertTrue(c2.valid); assertEquals(sys, c2.now())
    }
    @Test fun firstRunUsesNetworkTime() {
        val c = BoardClock(f, { "b" }, { true }, { T }); c.start(); assertTrue(c.valid)
        val off = BoardClock(File(f.path + "x"), { "b" }, { false }, { T }); off.start(); assertFalse(off.valid)
    }
}
