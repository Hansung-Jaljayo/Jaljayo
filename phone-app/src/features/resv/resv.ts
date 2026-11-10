// 자세 예약. 시안(index.html)의 r = { item, fail }과 같은 모양이다

import { useSyncExternalStore } from 'react'

import { nowMinutes } from '@/features/alarm/alarm'
import { resolvePoseKey } from '@/features/pose/poseStore'

// 자세 이름. 시안의 PRESETS와 같다
export type PoseKey = 'read' | 'tv' | 'rest' | 'sleep'
export const POSE_NAMES: Record<PoseKey, string> = { read: '독서', tv: 'TV', rest: '휴식', sleep: '잠' }
// 바꿀 자세 버튼 순서
export const POSE_ORDER: PoseKey[] = ['read', 'tv', 'rest', 'sleep']

// 예약 한 개: 그 시각에 침대가 소리 없이 자세를 바꾼다. 지금부터 24시간 안으로만 정할 수 있다
export type Resv = {
  // 자정부터 센 분(0~1439)
  time: number
  // 오늘부터 며칠 뒤(0 오늘, 1 내일)
  off: number
  // 자세 이름. 각도만 정했으면 null
  purpose: PoseKey | null
  // 머리·다리 각도(도)
  head: number
  leg: number
}

// 실행하지 못한 예약: 침대가 알려 준 제목과 이유
export type ResvFail = { title: string; reason: string }

// 예약까지 남은 분
export const resvMinsLeft = (it: Resv, now = nowMinutes()) => it.off * 1440 + it.time - now

// 요약 카드 아래 줄: "잠 자세로 바꿔요 · 머리 0° 다리 0°", 각도만 정했으면 "머리 20° 다리 5°로 바꿔요"
export const resvSubLabel = (it: Resv) =>
  it.purpose
    ? `${POSE_NAMES[it.purpose]} 자세로 바꿔요 · 머리 ${it.head}° 다리 ${it.leg}°`
    : `머리 ${it.head}° 다리 ${it.leg}°로 바꿔요`

// by분 앞당기거나(음수) 늦춘 예약. 지난 시각이나 24시간 넘어로는 옮기지 않는다(null)
export function shiftResv(it: Resv, by: number, now = nowMinutes()): Resv | null {
  const abs = it.off * 1440 + it.time + by
  if (abs <= now || abs > now + 1440) return null
  return { ...it, off: Math.floor(abs / 1440), time: abs % 1440 }
}

// 자세 예약 창에서 고르는 값. off가 없으면(바퀴로만 고름) 저장할 때 오늘·내일을 정한다
export type ResvDraft = { time: number; off: number | null; purpose: PoseKey }

// 창을 열 때: 예약이 있으면 그 값, 없으면 30분 뒤를 5분 단위로 내린 시각에 잠 자세
export const resvDraft = (it: Resv | null, now = nowMinutes()): ResvDraft =>
  it
    ? { time: it.time, off: it.off, purpose: it.purpose ?? 'sleep' }
    : { time: (now + 30 - ((now + 30) % 5)) % 1440, off: null, purpose: 'sleep' }

// 빠른 버튼: 지금부터 n분 뒤(날짜도 함께 정한다)
export const quickDraft = (d: ResvDraft, mins: number, now = nowMinutes()): ResvDraft => {
  const abs = now + mins
  return { ...d, time: abs % 1440, off: Math.floor(abs / 1440) }
}

// 저장할 예약. 지금부터 24시간 안이 아니면 null.
// 자세를 그대로 두고 시각만 바꾸면 예약에 저장해 둔 각도를 그대로 쓰고, 새 예약이거나 자세를 바꾸면 자세 탭이 그 자세로 가는 각도를 쓴다
export function resvFromDraft(d: ResvDraft, old: Resv | null, now = nowMinutes()): Resv | null {
  const off = d.off ?? (d.time > now ? 0 : 1)
  const abs = off * 1440 + d.time
  if (abs <= now || abs > now + 1440) return null
  // 자세 탭과 같은 각도(저장한 기본 각도 → 지난번 → 처음 각도)
  const v = resolvePoseKey(d.purpose)
  const angles = old && old.purpose === d.purpose ? { head: old.head, leg: old.leg } : { head: v.head, leg: v.foot }
  return { time: d.time, off, purpose: d.purpose, ...angles }
}

// 처음 모습: 피그마 "예약 탭 / 있음"처럼 오후 11:10에 잠 자세로 바꾸는 예약 하나(지났으면 내일).
// 지난 예약 하나는 알람과 겹쳐 실행되지 못했다. 예약을 취소하면 "예약 탭 / 없음 + 실패 카드"가 된다
export type ResvState = { item: Resv | null; fail: ResvFail | null }

export const sampleResv = (now = nowMinutes()): ResvState => {
  const time = 23 * 60 + 10
  return {
    item: { time, off: time > now ? 0 : 1, purpose: 'sleep', head: 0, leg: 0 },
    fail: { title: '오전 7:00 예약한 독서 자세 실행 실패', reason: '알람이 끝나지 않아 실행하지 않았어요' },
  }
}

// 침대가 알려 주는 예약 상태(지금 예약, 실행하지 못한 기록). 예약 탭은 useResvState()로 읽는다.
// 침대가 저장했다고 답하거나 새 상태를 알려 줄 때 setResvState로 바꾼다
// 처음 상태는 시안과 같게: 예약 없음 + 실행하지 못한 기록 하나(개발 도구의 "예약 없음"을 끄면 표본 예약이 생긴다)
let state: ResvState = { ...sampleResv(), item: null }
const listeners = new Set<() => void>()

export const getResvState = () => state

// 바뀐 값만 넘기면 된다
export function setResvState(patch: Partial<ResvState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useResvState = () => useSyncExternalStore(subscribe, getResvState, getResvState)
