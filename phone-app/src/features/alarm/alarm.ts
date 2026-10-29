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
  // 반복 알람만: 다음 한 번 건너뛸 날(오늘부터 며칠 뒤). 켤 때 고른 그 날짜 하나만 뺀다
  skipOff: number | null
  // 반복 알람만: 잠시 꺼 둔 마지막 날(오늘부터 며칠 뒤, 그날까지 울리지 않음)
  pauseTo: number | null
}

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
// 요일 줄은 월요일부터
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const WAY_NAMES: Record<AlarmWay, string> = {
  basic: '기본',
  leave_bed: '침대 이탈',
  q1: '질문 · 한 자리 덧셈',
  q2: '질문 · 두 자리 덧셈',
}

// 끄는 방법 펼친 칸의 고르는 칸들
export const WAY_OPTIONS: { value: AlarmWay; name: string; sub: string }[] = [
  { value: 'basic', name: '기본', sub: '버튼으로 꺼요' },
  { value: 'leave_bed', name: '침대 이탈', sub: '침대에서 나와야 꺼져요' },
  { value: 'q1', name: '질문 · 한 자리 덧셈', sub: '예: 7 + 8' },
  { value: 'q2', name: '질문 · 두 자리 덧셈', sub: '예: 36 + 27' },
]

export const VOLUME_NAMES: Record<AlarmVolume, string> = { 1: '작게', 2: '보통', 3: '크게' }

export const nowMinutes = (now = new Date()) => now.getHours() * 60 + now.getMinutes()

// 반복 알람이 앞으로 울릴 날(오늘부터 며칠 뒤)을 count개. 잠시 꺼 둔 기간과 건너뛸 날은 뺀다
export function nextRings(d: AlarmDraft, count = 1, now = nowMinutes(), today = new Date()): number[] {
  const out: number[] = []
  for (let off = 0; off < 100 && out.length < count; off++) {
    if (off === 0 && d.time <= now) continue
    if (d.pauseTo != null && off <= d.pauseTo) continue
    if (!d.days.includes((today.getDay() + off) % 7)) continue
    if (d.skipOff === off) continue
    out.push(off)
  }
  return out
}

// 바뀐 설정에 맞게 고친다
// 한 번 알람: 날짜를 고르지 않았거나 오늘 울릴 시각이 이미 지났으면 다음에 울릴 날로 맞추고, 반복에만 쓰는 설정은 지운다
// 반복 알람: 건너뛸 날이 일정에서 빠지면(요일·시각을 바꿈) 건너뛰기를 푼다
export function fixDraft(d: AlarmDraft, now = nowMinutes()): AlarmDraft {
  if (d.days.length) {
    if (d.skipOff != null && !nextRings({ ...d, skipOff: null, pauseTo: null }, Infinity, now).includes(d.skipOff))
      return { ...d, skipOff: null }
    return d
  }
  if (d.skipOff != null || d.pauseTo != null) d = { ...d, skipOff: null, pauseTo: null }
  if (d.dateOff == null || (d.dateOff === 0 && d.time <= now)) return { ...d, dateOff: d.time > now ? 0 : 1 }
  return d
}

// 새 알람: 오전 7:00, 끄는 방법 기본, 소리 보통
export const newAlarmDraft = (): AlarmDraft =>
  fixDraft({ time: 7 * 60, days: [], dateOff: null, way: 'basic', volume: 2, lift: false, skipOff: null, pauseTo: null })

// "10월 16일 금요일"
export function dateLabel(off: number | null, today = new Date()) {
  if (off == null) return ''
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`
}

// "내일", "모레", "토요일"
export function whenLabel(off: number, today = new Date()) {
  if (off <= 2) return ['오늘', '내일', '모레'][off]
  return `${DAY_NAMES[(today.getDay() + off) % 7]}요일`
}

// "오전 7시", "오후 2시 30분"
export function clockLabel(time: number) {
  const h = Math.floor(time / 60)
  const m = time % 60
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`
}

// 잠시 끄기 줄 값: "끄지 않음" 또는 "11월 5일까지"
export function pauseLabel(pauseTo: number | null, today = new Date()) {
  if (pauseTo == null) return '끄지 않음'
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + pauseTo)
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지`
}
