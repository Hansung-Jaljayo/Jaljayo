// 연결된 침대가 알려 주는 정보. 앱 어디서나 useBedInfo()로 읽는다.
// 아직 침대와 주고받는 길이 없어서 처음 값을 쓴다. 길이 생기면 침대가 알려 줄 때 setBedInfo로 바꾼다(보드 담당 규격을 따른다)

import { useSyncExternalStore } from 'react'

// 병원에서 정한 밤 시간: 이 시간에는 이름을 불러도 대답하지 않고 침대 버튼으로만 듣는다. 시각은 자정부터 센 분
export type NightTime = { on: boolean; from: number; to: number }

export type BedInfo = {
  // 이 폰에 등록된 침대가 있는지. 없으면 등록 화면부터 보인다
  registered: boolean
  // 앱과 침대가 연결돼 있는지
  connected: boolean
  // 앱을 열거나 다시 연결된 뒤 침대 상태를 읽는 중인지. 읽기 전에는 옛 값으로 조작하지 않게 막는다
  loading: boolean
  // 침대 프로그램 버전
  firmware: string
  // 침대가 지금 시각을 아는지. 모르면 시각에 맞춰 움직이는 알람·예약이 실행되지 않는다
  clockOk: boolean
  // 알람을 끄는 버튼이 있는지. 없으면 알람을 쓸 수 없다
  hasButton: boolean
  // 지금 울리고 있는 알람 번호. 울리는 동안은 그 알람을 바꾸거나 침대를 초기화하지 않는다(설계서 4장)
  ringingId: number | null
  // 병원용 침대면 병원에서 정한 값. 집에서 쓰는 침대면 null
  ward: {
    // 병원에서 붙인 이름(예: 사과). 머리에 "사과 침대"로 보인다
    name: string
    // 병원에서 알람을 쓰도록 했는지. 막으면 알람을 쓸 수 없다(예약은 소리가 없어 그대로 쓴다)
    alarmAllowed: boolean
    // 병원에서 정한 밤 시간
    night: NightTime
  } | null
}

// 처음 값: 시안처럼 연결된, 시각을 아는, 버튼이 있는 집 침대
let info: BedInfo = {
  registered: true,
  connected: true,
  loading: true,
  firmware: '0.2',
  clockOk: true,
  hasButton: true,
  ringingId: null,
  ward: null,
}

// 병원용 침대의 처음 값: 밤 10시부터 다음 날 아침 6시까지 이름 부르기를 끄고, 알람은 막는다(병실에서는 옆 환자에게 들림)
export const wardDefault = (name = '사과'): NonNullable<BedInfo['ward']> => ({
  name,
  alarmAllowed: false,
  night: { on: true, from: 22 * 60, to: 6 * 60 },
})
const listeners = new Set<() => void>()

export const getBedInfo = () => info

// 침대 정보를 바꾼다. 바뀐 값만 넘기면 된다
export function setBedInfo(patch: Partial<BedInfo>) {
  info = { ...info, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useBedInfo = () => useSyncExternalStore(subscribe, getBedInfo, getBedInfo)

// 지금이 밤 시간인지. 개발 도구에서 지금을 밤 시간으로 바꿔 볼 수 있다
let nightOverride: boolean | null = null
export function setNightOverride(on: boolean | null) {
  nightOverride = on
  listeners.forEach((l) => l())
}
export const getNightOverride = () => nightOverride
export function isNightNow(n: NightTime, now = new Date()) {
  if (nightOverride != null) return nightOverride
  const m = now.getHours() * 60 + now.getMinutes()
  return n.from <= n.to ? m >= n.from && m < n.to : m >= n.from || m < n.to
}

// 머리에 보이는 침대 이름: 병원용이면 "사과 침대", 집 침대면 "잘자요"
export const bedName = (b: BedInfo) => (b.ward ? `${b.ward.name} 침대` : '잘자요')
