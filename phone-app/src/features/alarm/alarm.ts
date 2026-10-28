// 알람 한 개의 설정. 시안(index.html)의 draft와 같은 모양이다

export type AlarmWay = 'basic' | 'leave_bed' | 'q1' | 'q2'
export type AlarmVolume = 1 | 2 | 3

export type AlarmDraft = {
  // 자정부터 센 분(0~1439)
  time: number
  // 반복할 요일(0 일요일 ~ 6 토요일). 비어 있으면 한 번 알람
  days: number[]
  // 한 번 알람이 울릴 날: 오늘부터 며칠 뒤
  dateOff: number | null
  way: AlarmWay
  volume: AlarmVolume
  // 알람 때 머리 올리기(처음엔 끔)
  lift: boolean
}

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
// 요일 줄은 월요일부터
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const WAY_NAMES: Record<AlarmWay, string> = {
  basic: '기본',
  leave_bed: '침대 이탈',
  q1: '질문 · 한 자리',
  q2: '질문 · 두 자리',
}

export const VOLUME_NAMES: Record<AlarmVolume, string> = { 1: '작게', 2: '보통', 3: '크게' }

export const nowMinutes = (now = new Date()) => now.getHours() * 60 + now.getMinutes()

// 날짜를 고르지 않았거나 오늘 울릴 시각이 이미 지났으면 다음에 울릴 날로 맞춘다
export function fixDate(d: AlarmDraft, now = nowMinutes()): AlarmDraft {
  if (d.days.length) return d
  if (d.dateOff == null || (d.dateOff === 0 && d.time <= now)) return { ...d, dateOff: d.time > now ? 0 : 1 }
  return d
}

// 새 알람: 오전 7:00, 끄는 방법 기본, 소리 보통
export const newAlarmDraft = (): AlarmDraft =>
  fixDate({ time: 7 * 60, days: [], dateOff: null, way: 'basic', volume: 2, lift: false })

// "10월 16일 금요일"
export function dateLabel(off: number | null, today = new Date()) {
  if (off == null) return ''
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`
}
