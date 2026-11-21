import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useState } from 'react'

// 탭 화면은 옆으로 넘기는 판 안에 있고 탭 막대는 판 위에 하나만 있다.
// 탭 안의 시트·확인 창은 탭 막대까지 덮어야 하므로, 판 밖 위층(PortalHost)에 그린다.
// PortalScope 안에서만 위층으로 옮기고, 그 밖(설정·등록 화면 등)에서는 제자리에 그린다

const nodes = new Map<number, React.ReactNode>()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
let seq = 0

const Scope = createContext(false)

export function PortalScope({ children }: { children: React.ReactNode }) {
  return <Scope.Provider value>{children}</Scope.Provider>
}

export function PortalHost() {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN((n) => n + 1)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  return (
    <>
      {[...nodes.entries()].map(([k, n]) => (
        <Fragment key={k}>{n}</Fragment>
      ))}
    </>
  )
}

function Lifted({ children }: { children: React.ReactNode }) {
  const [id] = useState(() => ++seq)
  useLayoutEffect(() => {
    nodes.set(id, children)
    emit()
  })
  useLayoutEffect(
    () => () => {
      nodes.delete(id)
      emit()
    },
    [id],
  )
  return null
}

export function Portal({ children }: { children: React.ReactNode }) {
  const lifted = useContext(Scope)
  return lifted ? <Lifted>{children}</Lifted> : <>{children}</>
}
