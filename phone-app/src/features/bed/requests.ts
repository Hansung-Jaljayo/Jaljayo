import { boardOpen, boardSend, setBoardReplyHandler } from './boardLink'

// 침대에 보내는 요청. 보낸 뒤 5초 넘게 답이 없으면 onTimeout을 부른다.
// 다시 시도해도 같은 요청 하나로 본다(침대는 같은 요청을 한 번만 처리한다).
// 보드에 접속돼 있으면 boardLink로 보내고 답을 받는다. 접속돼 있지 않으면 답이 오지 않는다(저장을 흉내 내지 않는다)

export const REPLY_TIMEOUT_MS = 5000

export type BedMessage =
  | { type: 'alarm-save'; body: unknown }
  | { type: 'alarm-delete'; body: { id: number } }
  | { type: 'resv-save'; body: unknown }
  | { type: 'resv-cancel'; body: null }
  // 등록: QR로 읽은 침대를 같은 와이파이에서 찾기 / 이 폰을 등록하기
  | { type: 'bed-find'; body: { qr: string } }
  | { type: 'bed-register'; body: { qr: string; replace: boolean } }
  // 와이파이 처음 설정: 침대 와이파이에 붙기 / 주변 와이파이 목록 / 공유기 와이파이로 옮기기
  | { type: 'wifi-join'; body: null }
  | { type: 'wifi-scan'; body: null }
  | { type: 'wifi-set'; body: { ssid: string; password: string } }
  // 침대 움직이기·멈추기
  | { type: 'bed-move'; body: { head: number; leg: number } }
  | { type: 'bed-stop'; body: null }
  // 자세별 기본 각도 저장·삭제
  | { type: 'pose-save'; body: { preset: string; head: number; leg: number } }
  | { type: 'pose-delete'; body: { preset: string } }
  // 침대 설정
  | { type: 'bed-reset'; body: null }
  | { type: 'name-save'; body: { name: string } }
  // 병원 관리(직원)
  | { type: 'admin-login'; body: { password: string } }
  | { type: 'admin-save'; body: { night: unknown; alarm: boolean; beds: number[] } }
  | { type: 'admin-password'; body: { password: string } }
  | { type: 'admin-move'; body: { bed: number; room: string; name: string } }
  | { type: 'admin-end'; body: { bed: number } }

// 침대가 답과 함께 보내 주는 값(예: 찾은 침대가 다른 폰에 등록돼 있는지). 형식은 보드 담당 규격을 따른다
export type BedReply = Record<string, unknown>

export type BedRequest = {
  // 답이 없을 때 같은 요청을 다시 보낸다
  retry: () => void
  // 기다리기를 그만둔다. 늦게 온 답은 적용하지 않는다
  cancel: () => void
}

type Pending = { message: BedMessage; onAck: (reply: BedReply) => void; timer: ReturnType<typeof setTimeout> | null }

const pending = new Map<number, Pending>()
let serial = 0

function transmit(id: number, message: BedMessage) {
  boardSend(id, message.type, message.body)
}

// 개발용: 침대 대신 답하는 시험 도구(src/dev)가 여기에 답을 정해 둔다. 실제 앱에서는 비어 있다.
// 답: 침대가 보낼 값 / 'timeout' 답이 오지 않은 것처럼 바로 실패 / null 답하지 않음(5초 뒤 그대로 실패)
export type DevAnswer = BedReply | 'timeout' | null
type DevResponder = { answer: (message: BedMessage) => DevAnswer; delayMs: (message: BedMessage) => number }
let devResponder: DevResponder | null = null
export const setDevResponder = (r: DevResponder | null) => {
  devResponder = r
}
function devAnswer(id: number, p: Pending, message: BedMessage, onTimeout: () => void) {
  const r = devResponder
  if (!r || boardOpen()) return
  setTimeout(() => {
    if (pending.get(id) !== p) return
    const a = r.answer(message)
    if (a === null) return
    if (a === 'timeout') {
      if (p.timer) clearTimeout(p.timer)
      p.timer = null
      onTimeout()
      return
    }
    receiveBedReply(id, a)
  }, r.delayMs(message))
}

export function startBedRequest(
  message: BedMessage,
  { onAck, onTimeout, timeoutMs = REPLY_TIMEOUT_MS }: { onAck: (reply: BedReply) => void; onTimeout: () => void; timeoutMs?: number },
): BedRequest {
  const id = ++serial
  const p: Pending = { message, onAck, timer: null }
  pending.set(id, p)
  const send = () => {
    if (p.timer) clearTimeout(p.timer)
    transmit(id, message)
    p.timer = setTimeout(() => {
      if (pending.get(id) === p) onTimeout()
    }, timeoutMs)
    devAnswer(id, p, message, onTimeout)
  }
  send()
  return {
    retry: () => {
      if (pending.get(id) === p) send()
    },
    cancel: () => {
      if (p.timer) clearTimeout(p.timer)
      pending.delete(id)
    },
  }
}

// 침대가 요청을 처리했다고 답했을 때
export function receiveBedReply(id: number, reply: BedReply = {}) {
  const p = pending.get(id)
  if (!p) return
  if (p.timer) clearTimeout(p.timer)
  pending.delete(id)
  p.onAck(reply)
}

setBoardReplyHandler(receiveBedReply)

// 침대에 명령만 보낸다(답을 기다리는 화면이 없는 움직임·멈춤)
export function sendBedCommand(message: BedMessage) {
  if (!boardOpen()) return
  const r: BedRequest = startBedRequest(message, { onAck: () => {}, onTimeout: () => r.cancel() })
}

// 답을 기다리는 요청 목록(개발 도구가 침대 대신 답할 때 쓴다)
export const pendingRequests = () => [...pending.entries()].map(([id, p]) => ({ id, message: p.message }))
