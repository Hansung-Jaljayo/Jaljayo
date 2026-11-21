// 병원용 침대: 부르는 이름(과일 12개), 병실, 보드에서 받은 병원 침대 목록과 병원 관리 상태.
// 침대 목록은 병원 관리에 들어올 때와 바꿀 때마다 보드에 admin-list로 다시 받는다(docs/interfaces/hospital-beds.md)

import { useSyncExternalStore } from 'react'

// 어르신도 아는 말, 두세 글자, 첫 글자가 모두 다른 과일 12개. svg는 24×24 선 그림
export const FRUITS: { name: string; svg: string }[] = [
  { name: '사과', svg: '<path d="M12 7.5c-2-1.6-6.4-1.2-6.9 3.4C4.6 15.6 7.8 20.5 10 20.5c1 0 1.2-.6 2-.6s1 .6 2 .6c2.2 0 5.4-4.9 4.9-9.6-.5-4.6-4.9-5-6.9-3.4Z"/><path d="M12 7.5c0-2 .6-3.4 2.2-4.3"/>' },
  { name: '포도', svg: '<circle cx="8" cy="9.5" r="2.1"/><circle cx="12" cy="9.5" r="2.1"/><circle cx="16" cy="9.5" r="2.1"/><circle cx="10" cy="13.4" r="2.1"/><circle cx="14" cy="13.4" r="2.1"/><circle cx="12" cy="17.3" r="2.1"/><path d="M12 7.4V4l2.2-1"/>' },
  { name: '수박', svg: '<path d="M3 8.5h18a9 9 0 0 1-18 0Z"/><path d="M6.2 8.5a5.8 5.8 0 0 0 11.6 0"/><path d="M9.5 11.5v.6M12 13.3v.6M14.5 11.5v.6"/>' },
  { name: '딸기', svg: '<path d="M12 8.2c-4.2 0-7 1.6-7 4.6 0 4.4 4.5 8.2 7 8.2s7-3.8 7-8.2c0-3-2.8-4.6-7-4.6Z"/><path d="M8.3 6.6 12 8.2l3.7-1.6M12 8.2V4.2"/><path d="M9.6 12.6h.01M14.4 12.6h.01M12 15.6h.01M9.8 17.4h.01M14.2 17.4h.01"/>' },
  { name: '자두', svg: '<circle cx="12" cy="13.5" r="6.8"/><path d="M12 6.7c-1.8 2.8-1.8 10.8 0 13.6"/><path d="M12 6.7V3.6"/>' },
  { name: '복숭아', svg: '<path d="M12 8.2C7.4 5.8 4.2 9.6 4.6 13.2c.5 4.4 3.9 7.3 7.4 7.3s6.9-2.9 7.4-7.3c.4-3.6-2.8-7.4-7.4-5Z"/><path d="M12 8.2c-1.2 3.2-1.2 8 0 12.3"/><path d="M12 8.2c.9-2.6 3-4.2 5.6-4.2-.9 2.2-3 3.7-5.6 4.2Z"/>' },
  { name: '바나나', svg: '<path d="M5.2 5.5C4.4 13 9.5 19.3 18.6 18.4l1.4-1.6C12.4 16.2 8.4 12 7.2 4.9Z"/><path d="M5.2 5.5 4.6 3.4"/>' },
  { name: '토마토', svg: '<circle cx="12" cy="13.6" r="7"/><path d="M8.4 8.6 10.4 9 12 7.5 13.6 9l2-.4"/><path d="M12 7.5V4.8"/>' },
  { name: '키위', svg: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.8"/><path d="M12 5.8v1.1M12 17.1v1.1M5.8 12h1.1M17.1 12h1.1M7.6 7.6l.8.8M15.6 15.6l.8.8M16.4 7.6l-.8.8M8.4 15.6l-.8.8"/>' },
  { name: '참외', svg: '<ellipse cx="12" cy="12" rx="8.6" ry="6.2"/><path d="M8 6.3c-1.1 3.6-1.1 7.8 0 11.4M12 5.8v12.4M16 6.3c1.1 3.6 1.1 7.8 0 11.4"/>' },
  { name: '망고', svg: '<path d="M7.2 18.2c-3-3-2.6-9.2 2-11.6 4.1-2.1 9.6-.6 10.6 4 1 4.6-3 9.2-7.6 9.2-1.9 0-3.5-.6-5-1.6Z"/><path d="M14.2 5.6c1-1.6 2.5-2.3 4.2-2.3"/>' },
  { name: '오렌지', svg: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="5.8"/><path d="M12 6.2v11.6M7 9.1l10 5.8M7 14.9l10-5.8"/>' },
]

export const fruitXml = (svg: string, stroke: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`

// 2층·3층 각 8개 병실
export const ROOMS = [2, 3].flatMap((f) => Array.from({ length: 8 }, (_, i) => `${f}0${i + 1}호`))
// 한 병실의 침대 번호(1~10)
export const BED_NOS = Array.from({ length: 10 }, (_, i) => i + 1)

// 병원 침대 하나(docs/interfaces/hospital-beds.md). id는 보드가 정한 고유 번호(예: B7Q2-1)라 글자다.
// name은 환자가 고른 과일 이름이고, 아직 고르지 않았거나 사용을 끝냈으면 null. ok는 지난 저장 때 답했는지(앱이 따로 센다)
export type WardBed = { id: string; room: string; no: number; name: string | null; phone: boolean; ok: boolean }

// 이 폰이 환자 폰으로 등록한 침대(bed-register 답). used는 같은 호실에서 이미 쓰는 과일 이름
export type MyWardBed = { id: string; room: string; no: number; used: string[] }

type Hospital = {
  // 보드가 admin-list로 알려 준 병원 침대 목록. 병원 관리에 들어오기 전에는 비어 있다
  beds: WardBed[]
  // 보드가 알려 준 호실 목록(없으면 ROOMS)
  rooms: string[]
  // 목록을 한 번이라도 받았는지
  loaded: boolean
  // 지난 저장 때 답하지 않은 침대 고유 번호
  unconfirmed: string[]
  // 병원 관리 화면 아래 결과 한 줄
  message: string
  // 침대 목록 화면 위 결과 한 줄(추가·빼기 뒤)
  bedsMessage: string
  // 지금 보고 있는 침대(침대 하나 화면)
  bedId: string | null
  // 이 폰이 등록한 병원 침대
  mine: MyWardBed | null
  // 직원이 이 폰의 침대 사용을 끝냈는지(병원 관리를 나가면 "사용을 끝낸 침대" 화면)
  endedMine: boolean
  // 병원 관리를 나가면 돌아갈 화면
  back: string | null
}

const EMPTY = { beds: [], rooms: ROOMS, loaded: false, unconfirmed: [], message: '', bedsMessage: '', bedId: null, endedMine: false }
let state: Hospital = { ...EMPTY, mine: null, back: null }
const listeners = new Set<() => void>()
export const getHospital = () => state
export function setHospital(patch: Partial<Hospital>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const resetHospital = () => setHospital({ ...EMPTY, mine: null })
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const useHospital = () => useSyncExternalStore(subscribe, getHospital, getHospital)

// 보드 답의 침대 하나를 읽는다. 모양이 맞지 않으면 null
export function bedFrom(v: unknown, ok = true): WardBed | null {
  if (!v || typeof v !== 'object') return null
  const b = v as Record<string, unknown>
  if (typeof b.id !== 'string' || typeof b.room !== 'string' || typeof b.no !== 'number') return null
  return { id: b.id, room: b.room, no: b.no, name: typeof b.name === 'string' && b.name ? b.name : null, phone: !!b.phone, ok }
}

// admin-list 답으로 목록을 바꾼다. 지난 저장 때 답하지 않았던 침대는 그 표시를 이어 간다
export function applyAdminList(reply: Record<string, unknown>) {
  const miss = state.unconfirmed
  const beds = (Array.isArray(reply.beds) ? reply.beds : [])
    .map((v) => bedFrom(v))
    .filter((b): b is WardBed => !!b)
    .map((b) => ({ ...b, ok: !miss.includes(b.id) }))
  const rooms = Array.isArray(reply.rooms) && reply.rooms.every((r) => typeof r === 'string') && reply.rooms.length ? (reply.rooms as string[]) : ROOMS
  setHospital({ beds, rooms, loaded: true, unconfirmed: miss.filter((id) => beds.some((b) => b.id === id)) })
}

// 호실 안 침대 번호 순서
export const byNo = (a: WardBed, b: WardBed) => a.no - b.no

// 같은 호실의 다른 침대가 쓰는 번호
export const usedNos = (beds: WardBed[], room: string, exceptId: string) =>
  beds.filter((b) => b.id !== exceptId && b.room === room).map((b) => b.no)

// 보드 답에 실린 거절 이유. 없으면 넘긴 기본 글
export const reasonOf = (reply: Record<string, unknown>, fallback: string) =>
  typeof reply.reason === 'string' && reply.reason ? reply.reason : fallback

// QR 글에서 고유 번호를 꺼낸다(jaljayo://bed/<id>)
export const idFromQr = (qr: string) => qr.replace(/^jaljayo:\/\/bed\//, '')
export const qrFromId = (id: string) => `jaljayo://bed/${id}`

export const CONTACT = '문의 이메일 준비 중'
