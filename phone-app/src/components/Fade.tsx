import { useEffect, useState } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

import { cssEase } from '@/theme/tokens'

const EASE = Easing.bezier(...cssEase)

// on이면 0.2초 동안 to만큼 흐려지고 누를 수 없다(시안 .loading .body > *, .tcard.wait 등의 transition: opacity .2s)
export function Fade({ on, to = 0.5, style, children }: { on: boolean; to?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const [op] = useState(() => new Animated.Value(on ? to : 1))
  useEffect(() => {
    Animated.timing(op, { toValue: on ? to : 1, duration: 200, easing: EASE, useNativeDriver: true }).start()
  }, [on, to, op])
  return (
    <Animated.View style={[style, { opacity: op }]} pointerEvents={on ? 'none' : 'auto'}>
      {children}
    </Animated.View>
  )
}
