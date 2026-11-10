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
  // 반복 알람만: 날짜별 예외(오늘부터 며칠 뒤 → 그 회차만 바꾼 시각·끄는 방법, 또는 다른 알람으로 덮어써 울리지 않음)
  exc?: Record<number, AlarmExc>
}

// 날짜별 예외: "이번만"으로 바꾼 회차, 또는 덮어써서 울리지 않는 회차
export type AlarmExc = { time: number; way: AlarmWay; drop?: false } | { drop: true }

// 실제로 울리는 회차 하나: 오늘부터 며칠 뒤, 그날 울리는 시각·끄는 방법(이번만 반영)
export type Ring = { off: number; tm: number; way: AlarmWay }

// 덮어써 울리지 않는 날만 남긴다(이번만은 뺀다)
export const dropsOnly = (exc: AlarmDraft['exc']): Record<number, AlarmExc> =>
  Object.fromEntries(Object.entries(exc ?? {}).filter(([, e]) => e.drop)) as Record<number, AlarmExc>

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

// 알람이 앞으로 실제로 울릴 회차를 count개(시안 nextRings). 날짜별로 바꾼 회차는 바꾼 시각으로,
// 잠시 꺼 둔 기간·덮어써 안 울리는 날·건너뛸 날은 뺀다. 한 번 알람은 그 날 하나
export function rings(d: AlarmDraft, count = Infinity, now = nowMinutes(), today = new Date()): Ring[] {
  const out: Ring[] = []
  const rep = d.days.length > 0
  for (let off = 0; off < 100 && out.length < count; off++) {
    const ex = rep ? d.exc?.[off] : undefined
    const tm = ex && !ex.drop ? ex.time : d.time
    if (off * 1440 + tm - now <= 0) continue
    if (d.pauseTo != null && off <= d.pauseTo) continue
    if (rep ? !d.days.includes((today.getDay() + off) % 7) : d.dateOff != null && off !== d.dateOff) continue
    if (ex?.drop) continue
    if (rep && d.skipOff === off) continue
    out.push({ off, tm, way: ex && !ex.drop ? ex.way : d.way })
    if (!rep) break
  }
  return out
}

// 반복 알람이 앞으로 울릴 날(오늘부터 며칠 뒤)을 count개
export function nextRings(d: AlarmDraft, count = 1, now = nowMinutes(), today = new Date()): number[] {
  if (!d.days.length) return []
  return rings(d, count, now, today).map((r) => r.off)
}

// 그 날짜의 회차(이번만 반영). 그날 울리지 않으면 없음
export const ringOn = (d: AlarmDraft, off: number, now = nowMinutes(), today = new Date()) =>
  rings(d, Infinity, now, today).find((r) => r.off === off)

// 바뀐 설정에 맞게 고친다
// 한 번 알람: 날짜를 고르지 않았거나 오늘 울릴 시각이 이미 지났으면 다음에 울릴 날로 맞추고, 반복에만 쓰는 설정은 지운다
// 반복 알람: 건너뛸 날이 일정에서 빠지면(요일·시각을 바꿈) 건너뛰기를 푼다
export function fixDraft(d: AlarmDraft, now = nowMinutes(), today = new Date()): AlarmDraft {
  if (d.days.length) {
    // 반복에서 빠진 요일의 날짜별 예외는 없앤다
    const exc = d.exc ?? {}
    const keep = Object.entries(exc).filter(([k]) => d.days.includes((today.getDay() + Number(k)) % 7))
    if (keep.length !== Object.keys(exc).length) d = { ...d, exc: Object.fromEntries(keep) }
    if (d.skipOff != null && !nextRings({ ...d, skipOff: null, pauseTo: null }, Infinity, now, today).includes(d.skipOff))
      return { ...d, skipOff: null }
    return d
  }
  if (d.skipOff != null || d.pauseTo != null || d.pauseDays != null || (d.exc && Object.keys(d.exc).length))
    d = { ...d, skipOff: null, pauseTo: null, pauseDays: null, exc: {} }
  if (d.dateOff == null || (d.dateOff === 0 && d.time <= now)) return { ...d, dateOff: d.time > now ? 0 : 1 }
  return d
}

// 새 알람: 오전 7:00, 끄는 방법 기본, 소리 보통
export const newAlarmDraft = (): AlarmDraft =>
  fixDraft({ time: 7 * 60, days: [], dateOff: null, way: 'basic', volume: 2, lift: false, skipOff: null, pauseTo: null, pauseDays: null, exc: {} })

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
  const b = { ...d, time: before.time, way: before.way, exc: dropsOnly(d.exc) }
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

// 켜진 알람 가운데 실제로 다음에 울릴 회차. 없으면 null
export function nextAlarm(alarms: Alarm[], now = nowMinutes(), today = new Date()) {
  let best: { alarm: Alarm; off: number; mins: number; tm: number; way: AlarmWay } | null = null
  for (const a of alarms) {
    if (!a.on) continue
    const r = rings(a, 1, now, today)[0]
    if (!r) continue
    const mins = r.off * 1440 + r.tm - now
    if (!best || mins < best.mins) best = { alarm: a, off: r.off, mins, tm: r.tm, way: r.way }
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

// 겹치는 다른 알람과 겹치는 회차들
export type Clash = { alarm: Alarm; hits: Ring[] }

// 같은 날 같은 시각에 울리는 다른 알람. 시각만이 아니라 실제로 울리는 회차로 본다(건너뛰기·잠시 끄기·이번만 반영).
// 꺼져 있어도 켜기 답을 기다리는 알람(busy)은 곧 켜질 일정이라 넣는다
export function findClashes(
  d: AlarmDraft,
  alarms: Alarm[],
  selfId?: number | null,
  busy: (id: number) => boolean = () => false,
  now = nowMinutes(),
  today = new Date(),
) {
  const mine = rings(d, Infinity, now, today)
  const out: Clash[] = []
  for (const a of alarms) {
    if (a.id === selfId || (!a.on && !busy(a.id))) continue
    const hits = rings(a, Infinity, now, today).filter((x) => mine.some((y) => y.off === x.off && y.tm === x.tm))
    if (hits.length) out.push({ alarm: a, hits })
  }
  return out
}

// 겹치는 알람 확인 창 글: "평일 오전 7시 알람과 10월 19일 월요일 오전 7시에 겹쳐요. 덮어쓸까요?"
export function clashLabel(c: Clash, today = new Date()) {
  const a = c.alarm
  const f = c.hits[0]
  const which = a.days.length ? daysLabel(a.days) : monthDayLabel(a.dateOff ?? f.off, today)
  const day = `${monthDayLabel(f.off, today)} ${DAY_NAMES[(today.getDay() + f.off) % 7]}요일`
  return `${which} ${clockLabel(a.time)} 알람과 ${day} ${clockLabel(f.tm)}에 겹쳐요. 덮어쓸까요?`
}

// 덮어쓰기(시안 overwrite): 기존 알람의 실제 회차 중 새 알람과 겹친 회차만 뺀다. 나머지 회차는 그대로 울린다
// - 한 번 알람은 그 한 회차가 겹친 것이라 지운다
// - 같은 시각의 반복끼리: 새 알람이 맡는 요일을 기존 알람에서 뺀다. 그 요일의 기존 회차 중 겹치지 않은 것
//   (새 알람이 건너뛰거나 꺼 두거나 시각을 바꾼 날, 기존 알람의 이번만)은 그 날짜의 한 번 알람으로 남긴다
// - 그 밖(새 알람이 한 번이거나 시각이 다른 반복): 겹친 날짜마다 그날만 울리지 않게 한다(다른 날짜의 예외는 그대로)
export function applyOverwrite(list: Alarm[], d: AlarmDraft, clashes: Clash[], now = nowMinutes(), today = new Date()) {
  let out = [...list]
  let id = Math.max(0, ...list.map((a) => a.id))
  for (const { alarm, hits } of clashes) {
    const a = out.find((x) => x.id === alarm.id)
    if (!a) continue
    if (!a.days.length) {
      out = out.filter((x) => x.id !== a.id)
      continue
    }
    let next: Alarm
    if (d.days.length && a.time === d.time) {
      const gone = d.days.filter((x) => a.days.includes(x))
      const hit = (x: Ring) => hits.some((h) => h.off === x.off && h.tm === x.tm)
      const { missed: _missed, ...rest } = a
      for (const x of rings(a, Infinity, now, today)) {
        if (!gone.includes((today.getDay() + x.off) % 7) || hit(x)) continue
        out.push({ ...rest, id: ++id, days: [], dateOff: x.off, time: x.tm, way: x.way, exc: {}, skipOff: null, pauseTo: null, pauseDays: null })
      }
      next = { ...a, days: a.days.filter((x) => !gone.includes(x)) }
    } else {
      const exc = { ...(a.exc ?? {}) }
      hits.forEach((h) => {
        exc[h.off] = { drop: true }
      })
      next = { ...a, exc }
    }
    // 요일이 줄어 건너뛸 날·예외가 빠졌으면 fixDraft가 푼다
    out = next.days.length
      ? out.map((x) => (x.id === a.id ? { ...next, ...fixDraft(next, now, today) } : x))
      : out.filter((x) => x.id !== a.id)
  }
  return out
}
