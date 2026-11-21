import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'

import { cssEase } from '@/theme/tokens'

const EASE = Easing.bezier(...cssEase)

// 색이 바뀔 때 ms 동안 앞 색에서 새 색으로 서서히 바꾼다(시안 CSS transition: background .2s 등)
export function useColorAnim(to: string, ms: number) {
  const [k] = useState(() => new Animated.Value(1))
  const [pair, setPair] = useState({ from: to, to })
  if (pair.to !== to) setPair({ from: pair.to, to })
  useEffect(() => {
    if (pair.from === pair.to) return
    k.setValue(0)
    Animated.timing(k, { toValue: 1, duration: ms, easing: EASE, useNativeDriver: false }).start()
  }, [pair, k, ms])
  return k.interpolate({ inputRange: [0, 1], outputRange: [pair.from, pair.to] })
}
