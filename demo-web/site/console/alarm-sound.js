// 알람 소리: 파일 없이 브라우저에서 만든다. 울리는 동안 "삐삐삐 - 쉼"을 반복한다
// 병상용 ward-1115/preview/src/alarmSound.ts 와 같은 내용
export function createAlarmSound(){
  let ac = null
  let timer = 0
  const burst = () => {
    if (!ac) return
    const t = ac.currentTime
    for (let k = 0; k < 3; k++) {
      const s = t + k * 0.16
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'square'; o.frequency.value = k === 2 ? 1175 : 988
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.07, s + 0.01); g.gain.setValueAtTime(0.07, s + 0.09); g.gain.linearRampToValueAtTime(0, s + 0.11)
      o.connect(g).connect(ac.destination); o.start(s); o.stop(s + 0.12)
    }
  }
  return {
    set(on) {
      if (on && !timer) {
        try { ac = ac ?? new AudioContext(); void ac.resume() } catch { return }
        burst(); timer = window.setInterval(burst, 900)
      } else if (!on && timer) { clearInterval(timer); timer = 0 }
    },
  }
}
