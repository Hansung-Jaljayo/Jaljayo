// 연결된 침대가 알려 주는 정보. 앱 어디서나 useBedInfo()로 읽는다.
// 아직 침대와 주고받는 길이 없어서 처음 값을 쓴다. 길이 생기면 침대가 알려 줄 때 setBedInfo로 바꾼다(보드 담당 규격을 따른다)

import { useSyncExternalStore } from 'react'

export type BedInfo = {
  // 알람을 끄는 버튼이 있는지. 없으면 알람을 쓸 수 없다
  hasButton: boolean
}

// 처음 값: 시안처럼 버튼이 있는 침대
let info: BedInfo = { hasButton: true }
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
