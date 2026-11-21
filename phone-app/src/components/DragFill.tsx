import { useContext, useMemo, useState } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'

import { PullGestures } from './PullScroll'

// 한 줄로 늘어선 같은 폭 칸들(요일 등)을 누른 채 좌우로 끌어 한꺼번에 켜고 끈다.
// 처음 누른 칸이 꺼져 있었으면 처음 칸부터 손가락 아래 칸까지를 모두 켜고, 켜져 있었으면 모두 끈다.
// 되돌아가면 범위에서 빠진 칸은 누르기 전 상태로 돌아간다(손가락이 칸을 건너뛰어도 사이 칸까지).
// 누르기도 여기서 받는다: 살짝 누르다 조금 밀려도(12px까지) 누른 칸을 켜고 끈다. 세로로 움직이면 바깥 시트가 스크롤한다
type Props = {
  count: number
  gap: number
  on: boolean[]
  onSet: (i: number, on: boolean) => void
  // 칸 하나를 눌렀을 때
  onTap: (i: number) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

function makeFill() {
  const s = { w: 0, gap: 0, count: 1, x0: 0, mode: true, first: 0, last: -1, before: [] as boolean[], on: [] as boolean[], set: (_i: number, _on: boolean) => {}, tap: (_i: number) => {} }
  const slot = (x: number) => {
    const step = (s.w + s.gap) / s.count
    return Math.max(0, Math.min(s.count - 1, Math.floor((x + s.gap / 2) / step)))
  }
  // 처음 칸~i 범위는 고른 상태로, 범위 밖은 누르기 전 상태로
  const reach = (i: number) => {
    if (i === s.last) return
    const lo = Math.min(s.first, i),
      hi = Math.max(s.first, i)
    for (let k = 0; k < s.count; k++) {
      const want = k >= lo && k <= hi ? s.mode : s.before[k]
      if (s.on[k] !== want) {
        s.on[k] = want
        s.set(k, want)
      }
    }
    s.last = i
  }
  const gesture = (outer: GestureType[] | null, disabled: boolean) => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!disabled)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onBegin((e) => {
        s.x0 = e.x
      })
      .onStart((e) => {
        s.first = slot(s.x0)
        s.before = [...s.on]
        s.on = [...s.on]
        s.mode = !s.before[s.first]
        s.last = -1
        reach(slot(e.x))
      })
      .onUpdate((e) => reach(slot(e.x)))
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(!disabled)
      .maxDistance(12)
      .onEnd((e, ok) => {
        if (ok) s.tap(slot(e.x))
      })
    if (outer) {
      pan.blocksExternalGesture(...outer)
      tap.blocksExternalGesture(...outer)
    }
    return Gesture.Race(pan, tap)
  }
  return {
    gesture,
    update: (p: { gap: number; count: number; on: boolean[]; set: (i: number, on: boolean) => void; tap: (i: number) => void }) =>
      void Object.assign(s, p),
    setW: (w: number) => void (s.w = w),
  }
}

export function DragFill({ count, gap, on, onSet, onTap, disabled = false, style, children }: Props) {
  const [f] = useState(makeFill)
  // 끄는 동안 바뀐 켜짐 상태와 최신 onSet을 손동작이 쓰게 넘긴다(효과 대신 손동작 시작 때 읽힌다)
  f.update({ gap, count, on, set: onSet, tap: onTap })
  const outer = useContext(PullGestures)
  const gesture = useMemo(() => f.gesture(outer, disabled), [f, outer, disabled])
  return (
    <GestureDetector gesture={gesture}>
      <View style={style} collapsable={false} onLayout={(e) => f.setW(e.nativeEvent.layout.width)}>
        {children}
      </View>
    </GestureDetector>
  )
}
