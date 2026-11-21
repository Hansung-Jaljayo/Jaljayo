import { useCallback, useEffect, useRef, useState } from 'react'

import { type BedMessage, type BedReply, type BedRequest, startBedRequest } from './requests'

// 화면 하나에서 침대에 요청 하나를 보내고 답을 기다린다.
// 기다리는 중이면 waiting, 5초 넘게 답이 없으면 timedOut(같은 요청을 retry로 다시 보낸다).
// 화면이 사라지면 기다리기를 그만둔다(늦게 온 답은 적용하지 않는다)
export function useBedRequest() {
  const req = useRef<BedRequest | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const cancel = useCallback(() => {
    req.current?.cancel()
    req.current = null
    setWaiting(false)
    setTimedOut(false)
  }, [])

  useEffect(() => () => req.current?.cancel(), [])

  const send = useCallback(
    (message: BedMessage, onAck: (reply: BedReply) => void, onTimeout?: () => void, timeoutMs?: number) => {
      req.current?.cancel()
      setWaiting(true)
      setTimedOut(false)
      const r = startBedRequest(message, {
        onAck: (reply) => {
          if (req.current !== r) return
          req.current = null
          setWaiting(false)
          setTimedOut(false)
          onAck(reply)
        },
        onTimeout: () => {
          if (req.current !== r) return
          setTimedOut(true)
          onTimeout?.()
        },
        timeoutMs,
      })
      req.current = r
    },
    [],
  )

  const retry = useCallback(() => {
    if (!req.current) return
    setTimedOut(false)
    req.current.retry()
  }, [])

  return { send, retry, cancel, waiting, timedOut, pending: waiting }
}
