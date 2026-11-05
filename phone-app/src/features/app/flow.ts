// 앱 전체 화면 흐름: 등록·오류·병원 관리처럼 탭 위를 덮는 화면, 설정 화면, 약관 글 화면.
// 탭(자세·알람·예약)은 그대로 두고 이 값에 맞는 화면을 위에 그린다

import { useEffect, useSyncExternalStore } from 'react'

// 탭 위를 덮는 화면. null이면 탭이 보인다
export type ObState =
  | 'splash' // 시작 화면(앱 아이콘의 침대 그림)
  | 'scan' // QR 찍기
  | 'finding' // QR을 읽고 같은 와이파이에서 침대를 찾는 중
  | 'swap' // 다른 폰에 등록된 침대
  | 'kicked' // 다른 폰이 이 침대를 등록해 이 폰으로는 조작할 수 없음
  | 'notfound' // 침대를 못 찾음
  | 'nocam' // 카메라 권한 없음
  | 'nolan' // 로컬 네트워크 권한 없음
  | 'confirming' // 등록 결과 확인 중
  | 'confirmfail' // 등록됐는지 확인 못 함
  | 'wjoin' // 와이파이 처음 설정: 침대 와이파이에 붙는 중
  | 'wjoinfail'
  | 'wlist' // 와이파이 고르기
  | 'wpass' // 와이파이 비밀번호
  | 'wmove' // 침대가 공유기 와이파이로 옮기는 중
  | 'wfail'
  | 'upapp' // 앱 업데이트 필요
  | 'upboard' // 침대 프로그램 업데이트 필요
  | 'name' // 병원용: 부르는 이름 고르기
  | 'night' // 병원용: 밤 시간 보기
  | 'ended' // 병원에서 사용을 끝낸 침대
  | 'done' // 등록됐어요
  | 'apw' // 병원 관리: 비밀번호
  | 'admin' // 병원 관리
  | 'abeds' // 병원 관리: 침대 목록
  | 'abed' // 병원 관리: 침대 하나
  | 'apwc' // 병원 관리: 비밀번호 바꾸기

export type DocKey = 'privacy' | 'terms' | 'oss'

type Flow = {
  ob: ObState | null
  settings: boolean
  doc: DocKey | null
  // 침대 초기화로 지운 횟수. 바뀌면 탭을 처음 상태로 다시 그린다
  wipe: number
  // 바깥(개발 도구)에서 고르라고 한 탭. 탭 화면이 읽고 비운다
  tabAsk: { key: 'pose' | 'alarm' | 'resv'; n: number } | null
}

let flow: Flow = { ob: 'splash', settings: false, doc: null, wipe: 0, tabAsk: null }
const listeners = new Set<() => void>()

export const getFlow = () => flow
export function setFlow(patch: Partial<Flow>) {
  flow = { ...flow, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const useFlow = () => useSyncExternalStore(subscribe, getFlow, getFlow)

export const goOb = (ob: ObState | null) => setFlow({ ob })
export const openSettings = () => setFlow({ settings: true })
export const closeSettings = () => setFlow({ settings: false, doc: null })

// 덮은 화면 안에서 먼저 닫을 것(펼친 시간 바퀴·병실 목록·확인 줄)이나 기다리는 중인 저장이 있으면
// 그 화면이 이 처리기를 걸어 둔다. true를 돌려주면 뒤로 버튼을 거기서 끝낸다
export const innerBack: { current: (() => boolean) | null } = { current: null }

// 화면이 보이는 동안 innerBack을 걸어 둔다
export function useInnerBack(handler: () => boolean) {
  useEffect(() => {
    innerBack.current = handler
    return () => {
      if (innerBack.current === handler) innerBack.current = null
    }
  })
}
