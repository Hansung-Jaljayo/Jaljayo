// 연결된 침대가 알려 주는 정보. 앱 어디서나 useBedInfo()로 읽는다.
// 아직 침대와 주고받는 길이 없어서 처음 값을 쓴다. 길이 생기면 침대가 알려 줄 때 setBedInfo로 바꾼다(보드 담당 규격을 따른다)

import { useSyncExternalStore } from 'react'

export type BedInfo = {
  // 침대가 지금 시각을 아는지. 모르면 시각에 맞춰 움직이는 알람·예약이 실행되지 않는다
  clockOk: boolean
  // 알람을 끄는 버튼이 있는지. 없으면 알람을 쓸 수 없다
  hasButton: boolean
  // 병원용 침대면 병원에서 정한 값. 집에서 쓰는 침대면 null
  ward: {
    // 병원에서 붙인 이름(예: 사과). 머리에 "사과 침대"로 보인다
    name: string
    // 병원에서 알람을 쓰도록 했는지. 막으면 알람을 쓸 수 없다(예약은 소리가 없어 그대로 쓴다)
    alarmAllowed: boolean
  } | null
}

// 처음 값: 시안처럼 시각을 아는, 버튼이 있는 집 침대
let info: BedInfo = { clockOk: true, hasButton: true, ward: null }
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

// 머리에 보이는 침대 이름: 병원용이면 "사과 침대", 집 침대면 "잘자요"
export const bedName = (b: BedInfo) => (b.ward ? `${b.ward.name} 침대` : '잘자요')
