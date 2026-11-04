import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'

import { useReduceMotion } from './useReduceMotion'

type Props = {
  color: string
}

// 돌아가는 표시: 오른쪽 한 칸이 빈 고리가 0.8초에 한 바퀴 돈다(동작 줄이기를 켠 기기는 2초)
export function Spinner({ color }: Props) {
  const reduceMotion = useReduceMotion()
  const [turn] = useState(() => new Animated.Value(0))

  useEffect(() => {
    turn.setValue(0)
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: reduceMotion ? 2000 : 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [turn, reduceMotion])

  return (
    <Animated.View
      aria-hidden
      style={[
        styles.ring,
        { borderColor: color, borderRightColor: 'transparent', transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5 },
})
