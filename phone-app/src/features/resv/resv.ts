// 자세 예약. 시안(index.html)의 r = { item, fail }과 같은 모양이다

import { nowMinutes } from '@/features/alarm/alarm'

// 자세 이름. 시안의 PRESETS와 같다
export type PoseKey = 'read' | 'tv' | 'rest' | 'sleep'
export const POSE_NAMES: Record<PoseKey, string> = { read: '독서', tv: 'TV', rest: '휴식', sleep: '잠' }

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

// 처음 모습: 피그마 "예약 탭 / 있음"처럼 오후 11:10에 잠 자세로 바꾸는 예약 하나(지났으면 내일).
// 지난 예약 하나는 알람과 겹쳐 실행되지 못했다. 예약을 취소하면 "예약 탭 / 없음 + 실패 카드"가 된다
export const sampleResv = (now = nowMinutes()): { item: Resv | null; fail: ResvFail | null } => {
  const time = 23 * 60 + 10
  return {
    item: { time, off: time > now ? 0 : 1, purpose: 'sleep', head: 0, leg: 0 },
    fail: { title: '오전 7:00 예약한 독서 자세 실행 실패', reason: '알람이 끝나지 않아 실행하지 않았어요' },
  }
}
