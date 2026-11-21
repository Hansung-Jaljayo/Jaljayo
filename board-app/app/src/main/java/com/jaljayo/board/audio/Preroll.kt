package com.jaljayo.board.audio

// 말 구간 앞 여유(11/05): VAD는 말이 시작됐다고 판단한 지점부터 구간을 잘라 준다. 그 판단이 늦으면 첫 자음이 잘려
// "잘자요"가 "달자", "살저"로 받아써졌다(보드 실측, 버튼을 눌러 미리 녹음하는 선배 앱은 같은 모델로 잘 받아씀).
// 그래서 들어온 소리를 최근 몇 초씩 보관해 두고, 구간 바로 앞 소리를 붙여 받아쓰기에 넘긴다.
// 위치는 VAD와 같은 기준(마지막 reset 뒤 받은 샘플 수)으로 센다.
class Preroll(private val size: Int) {
    private val ring = FloatArray(size)
    var total = 0L          // 마지막 reset 뒤 받은 샘플 수
        private set

    fun reset() { total = 0 }

    fun add(x: FloatArray) {
        for (v in x) { ring[(total % size).toInt()] = v; total++ }
    }

    /** start(VAD 구간 시작 위치) 바로 앞 pre개를 seg 앞에 붙인다. 보관 범위를 벗어나거나 위치가 이상하면 seg 그대로 */
    fun withPreroll(start: Long, seg: FloatArray, pre: Int): FloatArray {
        if (start < 0 || start > total || pre <= 0) return seg
        val from = maxOf(0L, start - pre, total - size)
        if (from >= start) return seg
        val n = (start - from).toInt()
        val out = FloatArray(n + seg.size)
        for (i in 0 until n) out[i] = ring[((from + i) % size).toInt()]
        System.arraycopy(seg, 0, out, n, seg.size)
        return out
    }
}
