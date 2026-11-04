import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet } from 'react-native'

import { color, motion, radius, shadow } from '@/theme/tokens'

type Props = {
  value: boolean
  onValueChange: (next: boolean) => void
  accessibilityLabel: string
  disabled?: boolean
}

// 피그마 컴포넌트 "sw · 스위치". 켜짐은 복숭아색, 꺼짐은 회갈색. 손잡이는 26 옮겨 간다
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: Props) {
  const [t] = useState(() => new Animated.Value(value ? 1 : 0))

  useEffect(() => {
    Animated.timing(t, {
      toValue: value ? 1 : 0,
      duration: motion.switch.duration,
      easing: Easing.bezier(...motion.switch.bezier),
      useNativeDriver: false,
    }).start()
  }, [value, t])

  return (
    <Pressable
      role="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: t.interpolate({ inputRange: [0, 1], outputRange: [color.switchOff, color['accent-strong']] }) },
        ]}
      >
        <Animated.View
          style={[styles.knob, { transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) }] }]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: { width: 64, height: 38, borderRadius: radius[19] },
  knob: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: color.white,
    boxShadow: shadow.switchKnob,
  },
})
