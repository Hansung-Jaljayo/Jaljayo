import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULTS, LIMIT, PURPOSE_NAME, initialState, type Angles, type BedState, type Part, type Purpose } from './engine'

const SPEED = 25 // 시연용 이동 속도(도/초). 실제 모터처럼 거의 일정한 속도로 움직인다
const RAMP = 0.25 // 출발할 때 가속하고 도착할 때 감속하는 시간(초)

// 짧게 가속 → 일정한 속도 → 짧게 감속. 거리 d를 t초에 얼마나 갔는지 돌려준다
// 거리가 짧아 최고 속도에 못 미치면 가속하다 바로 감속한다
function profile(d: number) {
  const a = SPEED / RAMP
  if (d <= SPEED * RAMP) {
    const th = Math.sqrt(d / a)
    return { total: 2 * th, at: (t: number) => (t < th ? 0.5 * a * t * t : d - 0.5 * a * (2 * th - t) ** 2) }
  }
  const total = d / SPEED + RAMP
  return {
    total,
    at: (t: number) => (t < RAMP ? 0.5 * a * t * t : t < total - RAMP ? 0.5 * SPEED * RAMP + SPEED * (t - RAMP) : d - 0.5 * a * (total - t) ** 2),
  }
}
const JOG_SPEED = 15 // 버튼을 누르고 있을 때 움직이는 속도(도/초)
const JOG_RAMP = 0.25 // 누르기 시작해서 이 시간(초) 동안 서서히 빨라진다

// 상태와, 지금 각도를 목표 각도로 옮기는 움직임을 함께 관리한다
// 침대가 움직이는 모습은 시연의 내용 자체라서 '동작 줄이기' 설정이어도 움직임을 보여 준다(꾸밈용 깜빡임만 끈다)
export function useBed() {
  // 주소에 ?pose=read 처럼 붙이면 그 자세로 시작한다(발표 자료 캡처용). ?ring=1이면 알람이 울리는 상태로 시작한다
  const [state, setState] = useState<BedState>(() => {
    const q = new URLSearchParams(window.location.search)
    const pose = q.get('pose') as Purpose | null
    let s = initialState
    if (pose && pose in DEFAULTS) s = { ...s, angles: DEFAULTS[pose], target: DEFAULTS[pose], purpose: pose }
    // ?head=60&leg=40 처럼 각도를 바로 줄 수도 있다(검수 캡처용)
    const h = Number(q.get('head')), l = Number(q.get('leg'))
    if (q.has('head') || q.has('leg')) { const a = { head: h || 0, leg: l || 0 }; s = { ...s, angles: a, target: a, purpose: null } }
    if (q.get('ring') === '1') s = { ...s, ringing: true, alarm: { label: '내일 오전 7시', type: 'basic' }, note: '알람이 울려요. 소리만 울려요.' }
    return s
  })
  const anglesRef = useRef<Angles>(state.angles)
  anglesRef.current = state.angles

  const { head: th, leg: tl } = state.target
  const moving = state.angles.head !== th || state.angles.leg !== tl

  // 목표가 바뀔 때마다 지금 각도에서 새로 출발한다(멈춤 버튼은 목표를 지금 각도로 바꿔 그 자리에 선다)
  useEffect(() => {
    const from = anglesRef.current
    const to = { head: th, leg: tl }
    const dist = Math.max(Math.abs(to.head - from.head), Math.abs(to.leg - from.leg))
    if (dist === 0) { setState((s) => (s.after ? { ...s, speech: s.after, after: '', note: '' } : s)); return }
    const prof = profile(dist)
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const sec = Math.min(prof.total, (t - t0) / 1000)
      const k = sec >= prof.total ? 1 : prof.at(sec) / dist
      const angles = k === 1 ? to : { head: from.head + (to.head - from.head) * k, leg: from.leg + (to.leg - from.leg) * k }
      // 다 움직이면 그때 결과를 말한다
      setState((s) => (k === 1 && s.after ? { ...s, angles, speech: s.after, after: '', note: '' } : { ...s, angles }))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [th, tl])

  const apply = useCallback((fn: (s: BedState) => BedState) => setState(fn), [])

  // 직접 조절(시연용): 버튼을 누르고 있는 동안만 한 부위를 움직이고, 떼면 그 자리에서 멈춘다
  const jog = useRef<{ part: Part; dir: 1 | -1; raf: number } | null>(null)
  const [jogging, setJogging] = useState<{ part: Part; dir: 1 | -1 } | null>(null)
  const stopHold = useCallback(() => {
    const j = jog.current
    if (!j) return
    cancelAnimationFrame(j.raf)
    jog.current = null
    setJogging(null)
    setState((s) => ({ ...s, note: `직접 조절로 머리 ${Math.round(s.angles.head)}도 다리 ${Math.round(s.angles.leg)}도에 멈췄어요.` }))
  }, [])
  const startHold = useCallback((part: Part, dir: 1 | -1) => {
    if (jog.current) return
    const j = { part, dir, raf: 0 }
    jog.current = j
    setJogging({ part, dir })
    let last: number | null = null
    let held = 0
    const step = (t: number) => {
      if (jog.current !== j) return
      const dt = last === null ? 0 : Math.min(0.05, (t - last) / 1000)
      last = t
      held += dt
      const v = JOG_SPEED * Math.min(1, 0.25 + held / JOG_RAMP)
      setState((s) => {
        const angles = { ...s.angles, [part]: Math.max(0, Math.min(LIMIT[part], s.angles[part] + dir * v * dt)) }
        // 목표도 지금 각도로 같이 옮겨서, 다른 명령으로 움직이던 중이면 그 움직임을 대신한다
        return { ...s, angles, target: angles, purpose: null, after: '', pending: null, heard: '', output: '', speech: '', note: `직접 조절: ${part === 'head' ? '머리' : '다리'}를 ${dir > 0 ? '올리는' : '내리는'} 중` }
      })
      j.raf = requestAnimationFrame(step)
    }
    j.raf = requestAnimationFrame(step)
  }, [])
  // 버튼 밖에서 손을 떼거나 창을 벗어나도 멈춘다
  useEffect(() => {
    window.addEventListener('pointerup', stopHold)
    window.addEventListener('pointercancel', stopHold)
    window.addEventListener('blur', stopHold)
    return () => {
      window.removeEventListener('pointerup', stopHold)
      window.removeEventListener('pointercancel', stopHold)
      window.removeEventListener('blur', stopHold)
    }
  }, [stopHold])

  // 자세 카드: 그 목적의 저장된 각도(없으면 기본 각도)로 바로 움직인다
  const choosePreset = useCallback((p: Purpose) => {
    setState((s) => ({ ...s, undo: { target: s.target, purpose: s.purpose }, moveStart: s.angles, target: s.memory[p] ?? DEFAULTS[p], purpose: p, after: '', pending: null, heard: '', output: '', speech: '', note: `${PURPOSE_NAME[p]} 자세로 움직여요.` }))
  }, [])

  return { state, moving: moving || jogging !== null, jogging, apply, startHold, stopHold, choosePreset }
}
