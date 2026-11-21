// 보드와 주고받는 길. 형식은 잘자요 저장소 docs/interfaces/board-link.md
// 주소를 넣으면 WebSocket으로 접속하고, 끊기면 2초 뒤 다시 붙는다. 주소는 폰에 저장해 다음에 켤 때 다시 쓴다
import { File, Paths } from 'expo-file-system'
import { useSyncExternalStore } from 'react'
import { type Permission, PermissionsAndroid, Platform } from 'react-native'

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
// 11/19: 이 폰이 등록한 침대 고유 번호(bed-register 성공 때 저장). 있으면 앱을 켤 때 등록된 것으로 보고 hello의 bed로 보낸다.
// 없으면(새로 깔았거나 등록 해제·첫 화면에서 시작하기) QR 화면부터 시작한다
const regFile = () => new File(Paths.document, 'bed-reg.txt')
// 11/17 병원 시연: 보드 한 대가 사과·포도·딸기 침대를 맡을 때 이 폰은 사과 침대에만 붙는다(제품은 침대 한 대에 보드 한 대).
// 보드가 가정용 모드면 이 칸은 무시되고 지금 침대를 그대로 본다
const DEMO_BED = '사과'
let ws: WebSocket | null = null
let url = ''
let regId = ''
// 11/19: 마지막으로 붙지 못한 이유("침대를 찾지 못했어요" 화면에 작게 보인다)
let lastError = ''
// 안드로이드 16부터 같은 공유기 안 기기(보드)에 붙으려면 근처 기기(로컬 네트워크) 권한이 필요할 수 있다. 처음 붙기 전에 한 번 묻는다
let lanAsk: Promise<void> | null = null
function askLocalNetwork(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 36) return Promise.resolve()
  if (!lanAsk) {
    const want = ['android.permission.NEARBY_WIFI_DEVICES', ...(Number(Platform.Version) >= 37 ? ['android.permission.ACCESS_LOCAL_NETWORK'] : [])] as Permission[]
    lanAsk = PermissionsAndroid.requestMultiple(want)
      .then((r) => {
        const no = Object.entries(r).filter(([, v]) => v !== 'granted').map(([k]) => k.split('.').pop())
        if (no.length) lastError = `근처 기기 권한 없음(${no.join(', ')})`
      })
      .catch(() => {})
  }
  return lanAsk
}
// 화면에 보여 줄 마지막 연결 문제. 붙어 있으면 빈 글
export const boardProblem = () => (open || !url ? '' : `${url.replace(/^ws:\/\//, '')} · ${lastError || '응답 없음'}`)
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
  // 처음 붙을 때만 권한을 기다린다(물은 뒤에는 바로 붙음)
  if (Platform.OS === 'android' && Number(Platform.Version) >= 36 && !lanAsk) {
    void askLocalNetwork().then(() => connect())
    return
  }
  const me = new WebSocket(url)
  ws = me
  me.onopen = () => {
    if (ws !== me) return
    open = true
    lastError = ''
    // 등록한 침대가 있으면 그 고유 번호로, 등록 전이면 시연용 이름으로 붙는다(hospital-beds.md QR로 보드 찾기)
    me.send(JSON.stringify({ type: 'hello', role: 'phone', bed: regId || DEMO_BED }))
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
  me.onerror = (e) => {
    const msg = (e as unknown as { message?: string }).message
    lastError = msg ? msg.slice(0, 80) : '연결 오류'
    console.warn('보드 연결 오류', msg)
  }
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

// 등록한 침대 고유 번호를 저장한다. null이면 지운다(등록 해제·사용 끝·첫 화면에서 시작하기)
export function saveRegisteredBed(id: string | null) {
  regId = id ?? ''
  try {
    const f = regFile()
    if (!id) {
      if (f.exists) f.delete()
    } else {
      if (!f.exists) f.create()
      f.write(id)
    }
  } catch (err) {
    console.warn('등록 침대 저장 실패', err)
  }
}

// QR 글(jaljayo://bed/<id>?h=<IP>:<포트>)이나 손으로 넣은 글(<id>@<IP>[:포트], <id>)을 읽는다.
// qr은 보드에 보낼 글(jaljayo://bed/<id>), host는 보드 주소(없으면 null: 저장된 주소를 쓴다)
export function parseBedQr(text: string): { qr: string; id: string; host: string | null } {
  const t = text.trim()
  const rest = t.replace(/^jaljayo:\/\/bed\//i, '')
  const [idPart, query = ''] = rest.split('?')
  const [idRaw, at = ''] = idPart.split('@')
  const id = idRaw.trim().toUpperCase()
  const h = (query.match(/(?:^|&)h=([^&]+)/)?.[1] ?? at).trim()
  const host = h ? (h.includes(':') ? h : `${h}:8765`) : null
  return { qr: `jaljayo://bed/${id}`, id, host }
}

// 보드에 붙을 때까지 기다린다(최대 ms). 붙으면 done(true), 시간이 지나면 done(false). 돌려준 함수로 그만 기다린다
export function waitBoardOpen(ms: number, done: (ok: boolean) => void) {
  if (open) {
    done(true)
    return () => {}
  }
  let over = false
  const finish = (ok: boolean) => {
    if (over) return
    over = true
    statusSubs.delete(check)
    clearTimeout(t)
    done(ok)
  }
  const check = () => {
    if (open) finish(true)
  }
  statusSubs.add(check)
  const t = setTimeout(() => finish(false), ms)
  return () => {
    over = true
    statusSubs.delete(check)
    clearTimeout(t)
  }
}

// 11/19 데모 시연: 처음 깐 앱처럼 등록과 보드 주소를 지운다(화면은 부른 쪽이 QR 화면으로 돌린다)
export function forgetBoard() {
  saveRegisteredBed(null)
  setBoardUrl('')
}

// 앱을 켤 때 저장한 주소로 접속한다. 실제 앱에서 주소가 없으면 연결 안 됨으로 보인다.
// 등록한 침대가 저장돼 있지 않으면 실제 앱은 등록 전으로 시작한다(시작 화면 뒤 QR 화면)
export function startBoardLink() {
  if (started) return
  started = true
  try {
    const f = urlFile()
    if (f.exists) url = f.textSync().trim()
  } catch (err) {
    console.warn('보드 주소 읽기 실패', err)
  }
  try {
    const f = regFile()
    if (f.exists) regId = f.textSync().trim()
  } catch (err) {
    console.warn('등록 침대 읽기 실패', err)
  }
  if (regId) setBedInfo({ registered: true })
  else if (!__DEV__) setBedInfo({ registered: false })
  if (url) {
    setBedInfo({ connected: false })
    connect()
  } else if (!__DEV__) setBedInfo({ connected: false, loading: false })
  emitStatus()
}
