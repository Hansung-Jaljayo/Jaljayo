import { type ComponentRef, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'

import { color, motion } from '@/theme/tokens'

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>
  // 물결 색. 시안은 버튼 글자색(currentColor)을 12% 불투명도로 쓴다
  rippleColor?: string
  children?: React.ReactNode
}

type RippleState = { key: number; x: number; y: number; d: number; released: boolean }

// 시안의 "누를 때 효과": 누른 점에서 가장 먼 모서리까지 닿는 원이 퍼지고, 손을 떼면 사라진다.
// 갤럭시와 아이폰이 같은 모양이 되게 직접 그린다.
// 누를 때마다 물결을 새로 하나씩 만들어, 연달아 눌러도 매번 처음부터 퍼진다.
export function RippleButton({ style, rippleColor = color.fg, children, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const host = useRef<ComponentRef<typeof View>>(null)
  const size = useRef({ w: 0, h: 0 })
  const nextKey = useRef(0)
  const [ripples, setRipples] = useState<RippleState[]>([])

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }
  }

  const start = (e: GestureResponderEvent) => {
    const { w, h } = size.current
    // locationX는 손가락 아래 자식 기준이라, 버튼 자신의 화면 위치를 빼서 버튼 안 좌표로 바꾼다
    const box = host.current?.getBoundingClientRect()
    const x = box ? e.nativeEvent.pageX - box.left : e.nativeEvent.locationX
    const y = box ? e.nativeEvent.pageY - box.top : e.nativeEvent.locationY
    const d = 2 * Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 2
    const key = nextKey.current++
    // 이전 물결은 손을 뗀 것으로 보고 사라지게 둔다
    setRipples((rs) => [...rs.map((r) => ({ ...r, released: true })), { key, x, y, d, released: false }])
  }

  const end = () => {
    setRipples((rs) => rs.map((r) => (r.released ? r : { ...r, released: true })))
  }

  const remove = (key: number) => {
    setRipples((rs) => rs.filter((r) => r.key !== key))
  }

  return (
    <Pressable
      {...rest}
      ref={host}
      disabled={disabled}
      onLayout={onLayout}
      onPressIn={(e) => {
        start(e)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        end()
        onPressOut?.(e)
      }}
      style={[styles.host, style]}
    >
      {children}
      {ripples.map((r) => (
        <Ripple
          key={r.key}
          x={r.x}
          y={r.y}
          d={r.d}
          released={r.released}
          color={rippleColor}
          onDone={() => remove(r.key)}
        />
      ))}
    </Pressable>
  )
}

// 물결 하나. 자기 애니메이션 값을 따로 가져서 다른 물결과 섞이지 않는다
type RippleProps = Omit<RippleState, 'key'> & { color: string; onDone: () => void }

function Ripple({ x, y, d, released, color: fill, onDone }: RippleProps) {
  const [scale] = useState(() => new Animated.Value(0))
  const [opacity] = useState(() => new Animated.Value(1))
  const [faded] = useState(() => Animated.multiply(opacity, 0.12))
  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: motion.rippleIn.duration,
      easing: Easing.bezier(...motion.rippleIn.bezier),
      useNativeDriver: true,
    }).start()
  }, [scale])

  useEffect(() => {
    if (!released) return
    Animated.timing(opacity, {
      toValue: 0,
      duration: motion.rippleOut.duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone()
    })
    // 손을 뗀 순간 한 번만 사라지기 시작하면 되므로 onDone은 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [released, opacity])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          left: x - d / 2,
          top: y - d / 2,
          backgroundColor: fill,
          opacity: faded,
          transform: [{ scale }],
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
  ripple: { position: 'absolute' },
})
