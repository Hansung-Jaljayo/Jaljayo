// 침대에 보내는 요청. 보낸 뒤 5초 넘게 답이 없으면 onTimeout을 부른다.
// 다시 시도해도 같은 요청 하나로 본다(침대는 같은 요청을 한 번만 처리한다).
// 아직 침대와 주고받는 길이 없어서 보내기만 하고 답은 오지 않는다. 길이 생기면 transmit에서 보내고,
// 침대의 답을 받는 곳에서 receiveBedReply(요청 번호)를 부른다. 저장을 흉내 내지는 않는다

export const REPLY_TIMEOUT_MS = 5000

export type BedMessage =
  | { type: 'alarm-save'; body: unknown }
  | { type: 'alarm-delete'; body: { id: number } }
  | { type: 'resv-save'; body: unknown }
  | { type: 'resv-cancel'; body: null }

export type BedRequest = {
  // 답이 없을 때 같은 요청을 다시 보낸다
  retry: () => void
  // 기다리기를 그만둔다. 늦게 온 답은 적용하지 않는다
  cancel: () => void
}

type Pending = { onAck: () => void; timer: ReturnType<typeof setTimeout> | null }

const pending = new Map<number, Pending>()
let serial = 0

// 침대로 보내는 자리(아직 길이 없음)
function transmit(_id: number, _message: BedMessage) {}

export function startBedRequest(
  message: BedMessage,
  { onAck, onTimeout }: { onAck: () => void; onTimeout: () => void },
): BedRequest {
  const id = ++serial
  const p: Pending = { onAck, timer: null }
  pending.set(id, p)
  const send = () => {
    if (p.timer) clearTimeout(p.timer)
    transmit(id, message)
    p.timer = setTimeout(() => {
      if (pending.get(id) === p) onTimeout()
    }, REPLY_TIMEOUT_MS)
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
export function receiveBedReply(id: number) {
  const p = pending.get(id)
  if (!p) return
  if (p.timer) clearTimeout(p.timer)
  pending.delete(id)
  p.onAck()
}
