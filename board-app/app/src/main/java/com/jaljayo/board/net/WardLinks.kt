package com.jaljayo.board.net

import com.jaljayo.board.brain.AlarmFinder
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedSim
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Purpose
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

// 11/17 병원 시연: 보드 한 대 안에 "가상 보드" 여럿(사과·포도·딸기)을 둔다. 제품에서는 침대 한 대에 보드 한 대이고,
// 그 보드에는 자기 침대 제어부 하나만 붙는다. 시연에서는 침대마다 이름 붙은 접속(hello role bed name)을 하나씩 받아
// 침대 이름 → 접속·BedLink로 나눠 둔다. 설계: docs/ward-multi-bed-design.md, 형식: docs/interfaces/board-link.md
// C는 접속(WebSocket). 안드로이드 없이 시험할 수 있게 접속 종류를 따로 두지 않았다
class WardLinks<C>(private val send: (C, JSONObject) -> Unit) {
    private val byName = HashMap<String, Pair<C, BedLink>>()
    private val ever = HashSet<String>()   // 한 번이라도 침대 제어부가 붙었던 침대

    /** 이름 붙은 침대 제어부가 붙었다. 같은 이름이 이미 있으면 새 접속으로 바꾸고 예전 접속을 돌려준다(끊을 것) */
    fun hello(name: String, conn: C, angles: Angles, target: Angles): C? {
        val old = byName.remove(name)?.first
        val link = BedLink { send(conn, it) }
        byName[name] = conn to link; ever += name
        link.start(angles, target)
        return old?.takeIf { it != conn }
    }

    fun nameOf(conn: C): String? = byName.entries.firstOrNull { it.value.first == conn }?.key
    fun link(name: String): BedLink? = byName[name]?.second
    fun linked(name: String) = byName.containsKey(name)
    /** 붙었다가 끊긴 침대. 진짜 침대라면 지금 각도를 알 수 없으니 움직이는 척하지 않는다 */
    fun lost(name: String) = name in ever && !linked(name)

    /** 접속이 끊겼다. 그 접속이 맡던 침대 이름(없으면 null) */
    fun left(conn: C): String? {
        val n = nameOf(conn) ?: return null
        byName.remove(n); return n
    }

    /** 병실 침대가 바뀌었을 때 남길 이름 말고는 떼어 내고, 떼어 낸 접속을 돌려준다(끊을 것) */
    fun retain(names: Collection<String>): List<C> {
        val gone = byName.keys.filter { it !in names }
        ever.retainAll(names.toSet())
        return gone.mapNotNull { byName.remove(it)?.first }
    }

    companion object {
        /**
         * 침대 하나를 한 번(dt초) 움직인다. 제어부가 붙어 있으면 목표를 보내고 돌려받은 각도를 쓴다.
         * 붙었다가 끊긴 침대(lost)는 그 자리에서 멈춘 것으로 본다. 붙은 적 없는 침대만 시뮬레이션으로 센다.
         * 결과의 after는 그대로 두므로 "다 움직이면 할 말"은 부르는 쪽이 꺼내 말한다
         */
        fun step(s0: BedState, link: BedLink?, lost: Boolean, sim: BedSim, dt: Double, onFinish: (String) -> Unit = {}): BedState {
            var s = s0
            if (link != null) {
                link.sync(s.angles, s.target)
                link.takeFinished()?.let { f ->
                    if (f.result != "arrived") { link.accept(f.angles); s = s.copy(angles = f.angles, target = f.angles, after = ""); onFinish(f.result) }
                }
            }
            if (!s.moving) return s
            return when {
                link != null -> s.copy(angles = link.latest ?: s.angles)
                lost -> s.copy(target = s.angles, after = "")
                else -> s.copy(angles = sim.step(s.angles, s.target, dt))
            }
        }

        private fun ang(a: Angles) = JSONObject().put("head", (a.head * 10).roundToInt() / 10.0).put("leg", (a.leg * 10).roundToInt() / 10.0)

        /** state 글의 ward 배열 한 칸. head·leg 정수 칸은 예전 화면을 위해 그대로 둔다 */
        fun entry(name: String, b: BedState?, active: Boolean, linked: Boolean, nowMs: Long): JSONObject {
            val o = JSONObject().put("name", name).put("active", active).put("linked", linked)
                .put("head", (b?.angles?.head ?: 0.0).roundToInt()).put("leg", (b?.angles?.leg ?: 0.0).roundToInt()).put("moving", b?.moving == true)
            if (b == null) return o
            val nowL = AlarmFinder.nowLocal(nowMs)
            val presets = JSONObject()
            for (p in listOf(Purpose.READ, Purpose.TV, Purpose.REST, Purpose.SLEEP)) presets.put(p.code, b.memory[p]?.let(::ang) ?: JSONObject.NULL)
            return o.put("angles", ang(b.angles)).put("target", ang(b.target))
                .put("purpose", b.purpose?.code ?: JSONObject.NULL)
                .put("asking", b.pending != null)
                .put("ringing", b.ringing != null).put("ringingType", b.ringing?.type ?: JSONObject.NULL)
                .put("reservation", b.reservation?.let { JSONObject().put("label", it.label).put("purpose", it.purpose.code).put("inMin", ((it.atMs - nowMs) / 60000.0).roundToInt()) } ?: JSONObject.NULL)
                .put("alarms", JSONArray(b.alarms.filter { it.next(nowL) != null || it.id == b.ringing?.id }.map { a -> JSONObject().put("label", a.label(nowL)).put("type", a.type).put("enabled", a.enabled) }))
                .put("presets", presets)
        }
    }
}
