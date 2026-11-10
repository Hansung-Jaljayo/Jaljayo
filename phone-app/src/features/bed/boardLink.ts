// 보드와 주고받는 길. 형식은 잘자요 저장소 docs/interfaces/board-link.md
// 주소를 넣으면 WebSocket으로 접속하고, 끊기면 2초 뒤 다시 붙는다. 주소는 폰에 저장해 다음에 켤 때 다시 쓴다
import { File, Paths } from 'expo-file-system'
import { useSyncExternalStore } from 'react'

import type { Alarm } from '@/features/alarm/alarm'
import { getPoseStore, PRESET_KEYS, setDefault } from '@/features/pose/poseStore'
import { type Resv, setResvState } from '@/features/resv/resv'

import { setBedInfo } from './bed'

export type BoardReply = Record<string, unknown>
export type BoardAngles = { head: number; leg: number; moving: boolean }
type AppState = {
  angles: { head: number; leg: number }
  moving: boolean
  clockOk: boolean
  ringingId: number | null
  alarms: Alarm[]
  resv: Resv | null
  presets: Record<string, { head: number; leg: number } | null>
}

const urlFile = () => new File(Paths.document, 'board-url.txt')
let ws: WebSocket | null = null
let url = ''
let retry: ReturnType<typeof setTimeout> | null = null
let open = false
let started = false
let onReply: (id: number, reply: BoardReply) => void = () => {}
let lastAlarms = ''
let alarms: Alarm[] | null = null
let lastResv = ''
const alarmSubs = new Set<(list: Alarm[]) => void>()
const angleSubs = new Set<(a: BoardAngles) => void>()
const statusSubs = new Set<() => void>()
const emitStatus = () => statusSubs.forEach((f) => f())

// requests.ts가 답을 받을 곳을 알려 준다(서로 불러오지 않게 여기서 받아 둔다)
export const setBoardReplyHandler = (f: typeof onReply) => {
  onReply = f
}
export const boardOpen = () => open
export const boardUrl = () => url
export function boardSend(id: number, name: string, body: unknown) {
  if (open) ws?.send(JSON.stringify({ type: 'req', id, name, body }))
}

// 보드가 알려 주는 알람 목록을 받는다. 이미 받은 목록이 있으면 바로 한 번 부른다
export function onBoardAlarms(f: (list: Alarm[]) => void) {
  alarmSubs.add(f)
  if (alarms) f(alarms)
  return () => {
    alarmSubs.delete(f)
  }
}
export function onBoardAngles(f: (a: BoardAngles) => void) {
  angleSubs.add(f)
  return () => {
    angleSubs.delete(f)
  }
}
export function useBoardStatus() {
  return useSyncExternalStore(
    (f) => {
      statusSubs.add(f)
      return () => {
        statusSubs.delete(f)
      }
    },
    () => (open ? 'open' : url ? 'trying' : 'none'),
  )
}

function apply(s: AppState) {
  setBedInfo({ connected: true, loading: false, clockOk: s.clockOk, ringingId: s.ringingId })
  const a = JSON.stringify(s.alarms)
  if (a !== lastAlarms) {
    lastAlarms = a
    alarms = s.alarms
    alarmSubs.forEach((f) => f(s.alarms))
  }
  const r = JSON.stringify(s.resv)
  if (r !== lastResv) {
    lastResv = r
    setResvState({ item: s.resv, fail: null })
  }
  PRESET_KEYS.forEach((k, i) => {
    const p = s.presets[k]
    const now = getPoseStore().defaults[i]
    const next = p ? { head: p.head, foot: p.leg } : null
    if (JSON.stringify(now) !== JSON.stringify(next)) setDefault(i, next)
  })
  angleSubs.forEach((f) => f({ ...s.angles, moving: s.moving }))
}

function connect() {
  if (!url || ws) return
  const me = new WebSocket(url)
  ws = me
  me.onopen = () => {
    if (ws !== me) return
    open = true
    me.send(JSON.stringify({ type: 'hello', role: 'phone' }))
    me.send(JSON.stringify({ type: 'time', epochMs: Date.now() }))
    emitStatus()
  }
  me.onmessage = (e) => {
    try {
      const m = JSON.parse(String(e.data))
      if (m.type === 'reply') {
        const { type: _t, id, ...reply } = m
        onReply(id, reply)
      } else if (m.type === 'app-state') apply(m)
    } catch (err) {
      console.warn('보드 글 해석 실패', err)
    }
  }
  me.onerror = (e) => console.warn('보드 연결 오류', (e as unknown as { message?: string }).message)
  me.onclose = () => {
    if (ws !== me) return
    ws = null
    open = false
    setBedInfo({ connected: false })
    emitStatus()
    retry = setTimeout(connect, 2000)
  }
}

// 주소를 정한다. 숫자 주소만 넣어도 된다(예: 192.168.0.10). 비우면 연결을 끊는다
export function setBoardUrl(text: string) {
  const t = text.trim()
  const next = !t ? '' : t.startsWith('ws') ? t : `ws://${t}${t.includes(':') ? '' : ':8765'}`
  if (next === url) return
  if (retry) clearTimeout(retry)
  const old = ws
  ws = null
  open = false
  old?.close()
  url = next
  lastAlarms = ''
  lastResv = ''
  try {
    const f = urlFile()
    if (!next) {
      if (f.exists) f.delete()
    } else {
      if (!f.exists) f.create()
      f.write(next)
    }
  } catch (err) {
    console.warn('보드 주소 저장 실패', err)
  }
  // 주소를 지우면 개발 중에는 시험 창이 침대를 대신하고, 실제 앱은 연결 안 됨으로 보인다
  if (!next) setBedInfo({ connected: __DEV__, loading: false })
  emitStatus()
  connect()
}

// 앱을 켤 때 저장한 주소로 접속한다. 실제 앱에서 주소가 없으면 연결 안 됨으로 보인다
export function startBoardLink() {
  if (started) return
  started = true
  try {
    const f = urlFile()
    if (f.exists) url = f.textSync().trim()
  } catch (err) {
    console.warn('보드 주소 읽기 실패', err)
  }
  if (url) {
    setBedInfo({ connected: false })
    connect()
  } else if (!__DEV__) setBedInfo({ connected: false, loading: false })
  emitStatus()
}
