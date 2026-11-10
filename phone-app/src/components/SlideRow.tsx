import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'

import { useReduceMotion } from './useReduceMotion'

const ease = Easing.bezier(0.4, 0, 0.2, 1)

// 조건에 따라 생기고 없어지는 줄(시안 showRow). 처음 그릴 때는 바로 그 상태,
// 그 뒤로는 내용은 제자리에 두고 줄 높이만 0.5초 동안 늘고 준다(두루마리). 동작 줄이기면 바로 바뀐다
// overlap: 안의 줄이 아래 선을 다음 줄과 겹치려고 marginBottom -1을 쓰면, 그 겹침을 바깥으로 옮겨 선이 잘리지 않게 한다
export function SlideRow({ show, overlap, children }: { show: boolean; overlap?: boolean; children: React.ReactNode }) {
  const reduceMotion = useReduceMotion()
  const [first] = useState(show)
  const [h, setH] = useState(0)
  const [k] = useState(() => new Animated.Value(show ? 1 : 0))
  // 닫히는 동안에는 그려 둔다
  const [present, setPresent] = useState(show)
  if (show && !present) setPresent(true)
  // 동작 줄이기면 바로 없앤다
  if (!show && present && reduceMotion) setPresent(false)

  useEffect(() => {
    if (reduceMotion) {
      k.setValue(show ? 1 : 0)
      return
    }
    const a = Animated.timing(k, { toValue: show ? 1 : 0, duration: 500, easing: ease, useNativeDriver: false })
    a.start(({ finished }) => {
      if (finished && !show) setPresent(false)
    })
    return () => a.stop()
  }, [show, k, reduceMotion])

  if (!present) return null
  // 높이를 재기 전: 처음부터 보이던 줄은 그대로, 새로 생기는 줄은 0에서 시작
  const height = h ? k.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) : first ? undefined : 0
  return (
    <Animated.View style={{ height, overflow: 'hidden', marginBottom: overlap ? -1 : 0 }} pointerEvents={show ? 'auto' : 'none'}>
      <View style={overlap && { paddingBottom: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  )
}
