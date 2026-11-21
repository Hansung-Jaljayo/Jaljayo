import { useSyncExternalStore } from 'react'

// 자세별 각도 기록. 자세 탭과 예약 탭이 같은 값을 읽는다(시안 PostureState.resolve)
export type Angles = { head: number; foot: number }
export const PRESET_KEYS = ['read', 'tv', 'rest', 'sleep'] as const
export type PresetKey = (typeof PRESET_KEYS)[number]
export const LIMIT = { head: 60, foot: 40 } as const

// 자세별 처음 각도(시안과 같다)
export const INITIAL_PRESETS: Angles[] = [
  { head: 45, foot: 15 }, // 독서
  { head: 30, foot: 10 }, // TV
  { head: 15, foot: 20 }, // 휴식
  { head: 0, foot: 0 }, // 잠
]

type Store = { defaults: (Angles | null)[]; last: (Angles | null)[] }

// 시안 표본: TV는 지난번에 25도로 썼다
const fresh = (): Store => ({ defaults: [null, null, null, null], last: [null, { head: 25, foot: 10 }, null, null] })
let store = fresh()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export const getPoseStore = () => store
export function usePoseStore() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => store,
  )
}

// 자세 버튼이 가는 각도: 저장한 기본 각도 → 없으면 지난번(직접 움직여 쓴 각도) → 없으면 처음 각도
export const resolvePose = (i: number, s: Store = store): Angles => s.defaults[i] ?? s.last[i] ?? INITIAL_PRESETS[i]
export const resolvePoseKey = (k: PresetKey) => resolvePose(PRESET_KEYS.indexOf(k))

export function setLast(i: number, a: Angles) {
  store = { ...store, last: store.last.map((x, k) => (k === i ? { ...a } : x)) }
  emit()
}
export function setDefault(i: number, a: Angles | null) {
  store = { ...store, defaults: store.defaults.map((x, k) => (k === i ? (a ? { ...a } : null) : x)) }
  emit()
}
// 침대 초기화: 자세 기록을 지운다
export function resetPoseStore() {
  store = { defaults: [null, null, null, null], last: [null, null, null, null] }
  emit()
}
