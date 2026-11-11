package com.jaljayo.board.brain

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// 실제 모터 대신 각도를 움직이는 시뮬레이션. 실제 침대에서는 이 자리에 침대 제어부로 보내는 신호가 들어간다.
// 각도는 실측이 아니라 시뮬레이션 값이다(PC 화면에도 그렇게 표시).
class BedSim(private val speedDegPerSec: Double = 6.0) {
    /** dt초 동안 target 쪽으로 움직인 새 각도 */
    fun step(cur: Angles, target: Angles, dt: Double): Angles {
        val d = speedDegPerSec * dt
        fun one(c: Double, t: Double) = if (abs(t - c) <= d) t else if (t > c) min(t, c + d) else max(t, c - d)
        return Angles(one(cur.head, target.head), one(cur.leg, target.leg))
    }
}
