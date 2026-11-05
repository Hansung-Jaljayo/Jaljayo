// 병원용 침대: 부르는 이름(과일 12개), 병실, 납품 때 넣어 보낸 침대 목록과 병원 관리 상태.
// 실제 앱은 침대 목록·관리 비밀번호를 납품 설정에서 받는다. 아직 그 길이 없어 시안과 같은 표본 목록으로 시작한다

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

export type WardBed = { id: number; room: string; name: string; phone: boolean; ok: boolean }

// 병실마다 침대 10대, 과일 12개 중 10개를 병실마다 다르게 돌려 쓴다. 1번(201호 사과)이 이 폰이 쓰는 침대
export const MY_BED = 1
const sampleBeds = (): WardBed[] =>
  ROOMS.flatMap((room, r) =>
    Array.from({ length: 10 }, (_, k) => ({
      room,
      name: FRUITS[k === 0 && r === 0 ? 0 : (k * 5 + r * 3) % 12].name,
      phone: (k * 7 + r * 3) % 10 < 8,
    })),
  ).map((b, i) => ({ ...b, id: i + 1, ok: true }))

type Hospital = {
  beds: WardBed[]
  // 지난 저장 때 답하지 않은 침대
  unconfirmed: number[]
  // 병원 관리 화면 아래 결과 한 줄
  message: string
  // 지금 보고 있는 침대(침대 하나 화면)
  bedId: number | null
  // 직원이 이 폰의 침대 사용을 끝냈는지(병원 관리를 나가면 "사용을 끝낸 침대" 화면)
  endedMine: boolean
  // 병원 관리를 나가면 돌아갈 화면
  back: string | null
}

let state: Hospital = { beds: sampleBeds(), unconfirmed: [], message: '', bedId: null, endedMine: false, back: null }
const listeners = new Set<() => void>()
export const getHospital = () => state
export function setHospital(patch: Partial<Hospital>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const resetHospital = () => setHospital({ beds: sampleBeds(), unconfirmed: [], message: '', bedId: null, endedMine: false })
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const useHospital = () => useSyncExternalStore(subscribe, getHospital, getHospital)

// 같은 병실의 다른 침대가 쓰는 이름
export const usedNames = (beds: WardBed[], room: string, exceptId: number) =>
  beds.filter((b) => b.id !== exceptId && b.room === room).map((b) => b.name)

export const CONTACT = '문의 이메일 준비 중'
