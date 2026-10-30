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
  // 반복 알람만: 잠시 끄기로 고른 기간(3·7·14일)
  pauseDays: number | null
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

// 소리 크기 펼친 칸의 고르는 칸들
export const VOLUME_OPTIONS: { value: AlarmVolume; name: string }[] = [
  { value: 1, name: '작게' },
  { value: 2, name: '보통' },
  { value: 3, name: '크게' },
]

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
  if (d.skipOff != null || d.pauseTo != null || d.pauseDays != null)
    d = { ...d, skipOff: null, pauseTo: null, pauseDays: null }
  if (d.dateOff == null || (d.dateOff === 0 && d.time <= now)) return { ...d, dateOff: d.time > now ? 0 : 1 }
  return d
}

// 새 알람: 오전 7:00, 끄는 방법 기본, 소리 보통
export const newAlarmDraft = (): AlarmDraft =>
  fixDraft({ time: 7 * 60, days: [], dateOff: null, way: 'basic', volume: 2, lift: false, skipOff: null, pauseTo: null, pauseDays: null })

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

// 잠시 끄기 펼친 칸의 고르는 칸들. 0은 끄지 않음
export const PAUSE_OPTIONS = [
  { value: 0, name: '끄지 않음' },
  { value: 3, name: '3일' },
  { value: 7, name: '1주' },
  { value: 14, name: '2주' },
]

// 잠시 끄기는 실제로 다음에 울릴 회차(건너뛰기 반영)가 오늘이면 오늘부터, 아니면 내일부터 센다
export function pauseFrom(d: AlarmDraft, now = nowMinutes()) {
  return nextRings({ ...d, pauseTo: null }, 1, now)[0] === 0 ? 0 : 1
}

// days일 동안 끄면 울리지 않는 마지막 날(오늘부터 며칠 뒤)
export const pauseEnd = (d: AlarmDraft, days: number, now = nowMinutes()) => pauseFrom(d, now) + days - 1

// 반복 알람을 고칠 때 바꾸는 범위. 이번만은 다음 한 회차의 시각·끄는 방법만 바꾼다
export type AlarmScope = 'once' | 'all'

// 반복 알람을 반복인 채로 시각이나 끄는 방법을 바꾸면 저장 전에 이번만·앞으로 계속을 묻는다
export const needsScope = (before: AlarmDraft | null | undefined, d: AlarmDraft) =>
  !!before && before.days.length > 0 && d.days.length > 0 && (d.time !== before.time || d.way !== before.way)

// 이번만으로 저장하면 반복의 시각·끄는 방법은 그대로다. 그 일정으로 끄는 기간을 다시 센다(pauseNew: 이 창에서 잠시 끄기를 새로 고름)
export function onceBase(before: AlarmDraft, d: AlarmDraft, pauseNew: boolean, now = nowMinutes()): AlarmDraft {
  const b = { ...d, time: before.time, way: before.way }
  return pauseNew && b.pauseDays ? { ...b, pauseTo: pauseEnd(b, b.pauseDays, now) } : b
}

// 이번만 바꿀 회차(오늘부터 며칠 뒤): 바꾼 요일·건너뛰기·잠시 끄기로, 원래 시각 기준 다음 회차
export const onceTarget = (before: AlarmDraft, d: AlarmDraft, pauseNew: boolean, now = nowMinutes()) =>
  nextRings(onceBase(before, d, pauseNew, now), 1, now)[0] as number | undefined

// 묻는 글: "반복 알람이에요. 10월 17일 토요일 한 번만 바꿀까요, 앞으로 계속 바꿀까요?"
// 잠시 끄기를 새로 골랐으면 두 범위마다 끄는 기간이 달라 줄을 나눠 보여 준다
export function scopeLabel(before: AlarmDraft, d: AlarmDraft, pauseNew: boolean, now = nowMinutes(), today = new Date()) {
  const b = onceBase(before, d, pauseNew, now)
  const f = nextRings(b, 1, now, today)[0]
  const fDay = f != null ? `${monthDayLabel(f, today)} ${DAY_NAMES[(today.getDay() + f) % 7]}요일` : ''
  if (pauseNew && d.pauseDays && b.pauseTo != null) {
    const allTo = pauseEnd(d, d.pauseDays, now)
    return (
      '반복 알람이에요. 어떻게 바꿀까요?\n' +
      `이번만: ${monthDayLabel(b.pauseTo, today)}까지 끄고${fDay ? `, ${fDay}만 ${clockLabel(d.time)}` : ''}\n` +
      `앞으로 계속: ${monthDayLabel(allTo, today)}까지 끄고, 그 뒤로 ${clockLabel(d.time)}`
    )
  }
  return fDay ? `반복 알람이에요. ${fDay} 한 번만 바꿀까요, 앞으로 계속 바꿀까요?` : '반복 알람이에요. 어떻게 바꿀까요?'
}

// 알람 탭 목록의 알람 한 개
// missed: 지난 회차를 울리지 못했을 때 침대가 알려 준 이유. 알람 고치기 창 맨 위에 보여 준다
export type Alarm = AlarmDraft & { id: number; on: boolean; missed?: string | null }

// 요약 카드 아래 줄: "침대 이탈 알람"
export const WAY_FULL_NAMES: Record<AlarmWay, string> = {
  basic: '기본 알람',
  leave_bed: '침대 이탈 알람',
  q1: '질문 알람',
  q2: '질문 알람',
}

// 시각을 작은 글과 큰 글로: { ampm: '오전', hm: '7:00' }
export function clockParts(time: number) {
  const h = Math.floor(time / 60)
  return { ampm: h < 12 ? '오전' : '오후', hm: `${h % 12 || 12}:${String(time % 60).padStart(2, '0')}` }
}

// 반복 요일: "평일", "주말", "매일", "월 수 금"
export function daysLabel(days: number[]) {
  const k = [...days].sort().join('')
  if (days.length === 7) return '매일'
  if (k === '12345') return '평일'
  if (k === '06') return '주말'
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d])
    .join(' ')
}

// "10월 17일"
export function monthDayLabel(off: number, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 목록 줄 아래 글: 반복이면 요일, 한 번이면 날짜
export const alarmMetaLabel = (a: AlarmDraft) =>
  a.days.length ? daysLabel(a.days) : a.dateOff != null ? monthDayLabel(a.dateOff) : '한 번'

// "8시간 30분 뒤", "1일 2시간 뒤"
export function inLabel(mins: number) {
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}일 ${h}시간 뒤`
  if (h) return `${h}시간${m ? ` ${m}분` : ''} 뒤`
  return `${m}분 뒤`
}

// 켜진 알람 가운데 실제로 다음에 울릴 것. 없으면 null
export function nextAlarm(alarms: Alarm[], now = nowMinutes(), today = new Date()) {
  let best: { alarm: Alarm; off: number; mins: number } | null = null
  for (const a of alarms) {
    if (!a.on) continue
    const off = a.days.length
      ? nextRings(a, 1, now, today)[0]
      : a.dateOff != null && (a.dateOff > 0 || a.time > now)
        ? a.dateOff
        : undefined
    if (off == null) continue
    const mins = off * 1440 + a.time - now
    if (!best || mins < best.mins) best = { alarm: a, off, mins }
  }
  return best
}

// 처음 목록: 시안(index.html)의 보기 알람 세 개. 평일 알람은 내일 한 번 건너뛰고, 주말 알람은 지난 토요일에 울리지 못했다
export const sampleAlarms = (): Alarm[] => [
  { ...fixDraft({ ...newAlarmDraft(), days: [1, 2, 3, 4, 5], skipOff: 1 }), id: 1, on: true },
  {
    ...fixDraft({ ...newAlarmDraft(), time: 8 * 60 + 30, days: [0, 6], way: 'leave_bed', volume: 3, lift: true }),
    id: 2,
    on: true,
    missed: '지난 토요일 오전 8:30은 앞 알람이 끝나지 않아 울리지 않았어요.',
  },
  { ...fixDraft({ ...newAlarmDraft(), time: 14 * 60, dateOff: 2, way: 'q2' }), id: 3, on: false },
]
