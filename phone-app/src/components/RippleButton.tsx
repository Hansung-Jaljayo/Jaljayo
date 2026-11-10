import { type ComponentRef, useEffect, useState } from 'react'
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
import Svg, { Circle } from 'react-native-svg'

import { color, motion } from '@/theme/tokens'

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>
  // 물결 색. 시안은 버튼 글자색(currentColor)을 12% 불투명도로 쓴다
  rippleColor?: string
  children?: React.ReactNode
}

type RippleState = { key: number; x: number; y: number; d: number; released: boolean }

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// 물결을 그릴 칸 하나. 칸에 ref·onLayout을 달고, 칸 안에 layer를 그린다.
// 누른 점에서 가장 먼 모서리까지 닿는 원이 0.42초 동안 퍼지고, 손을 떼면 0.26초 동안 옅어진다(시안 2717).
// 원은 SVG로 반지름을 키워 그린다: 둥근 칸을 확대하는 방식은 기기에 따라 작을 때 모서리가 각져 보일 수 있다
// clip: 물결이 넘치지 않게 자를 모서리(칸의 borderRadius). 칸 자체를 자르지 않아 그림자가 남는다
export function useRipple(fill: string = color.fg, clip?: ViewStyle) {
  // 물결을 그릴 칸(콜백 ref로 받는다)
  const [node, host] = useState<ComponentRef<typeof View> | null>(null)
  const [ripples, setRipples] = useState<RippleState[]>([])
  const [box, setBox] = useState({ w: 0, h: 0 })

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  const start = (e: GestureResponderEvent) => {
    const { w, h } = box
    // locationX는 손가락 아래 자식 기준이라, 칸의 화면 위치를 빼서 칸 안 좌표로 바꾼다
    const r = node?.getBoundingClientRect?.()
    const x = r ? e.nativeEvent.pageX - r.left : e.nativeEvent.locationX
    const y = r ? e.nativeEvent.pageY - r.top : e.nativeEvent.locationY
    const d = 2 * Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 2
    const key = Date.now() + Math.random()
    // 이전 물결은 손을 뗀 것으로 보고 사라지게 둔다
    setRipples((rs) => [...rs.map((q) => ({ ...q, released: true })), { key, x, y, d, released: false }])
  }

  const end = () => setRipples((rs) => rs.map((q) => (q.released ? q : { ...q, released: true })))
  const remove = (key: number) => setRipples((rs) => rs.filter((q) => q.key !== key))

  const layer = ripples.length ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, clip]}>
      {ripples.map((q) => (
        <Ripple key={q.key} x={q.x} y={q.y} d={q.d} released={q.released} w={box.w} h={box.h} fill={fill} onDone={() => remove(q.key)} />
      ))}
    </View>
  ) : null

  return { host, onLayout, start, end, layer }
}

// 시안의 "누를 때 효과"를 가진 버튼. 물결은 버튼 자신 안에서 퍼진다
export function RippleButton({ style, rippleColor = color.fg, children, onPressIn, onPressOut, disabled, ...rest }: Props) {
  // 버튼 모서리를 물결 층에도 준다. 그림자가 있는 버튼은 버튼 자체를 자르지 않는다(아이폰은 자르면 그림자가 사라진다)
  const flat = StyleSheet.flatten(style) ?? {}
  const clip = pickRadius(flat)
  const shadowed = flat.shadowOpacity != null || flat.elevation != null || flat.boxShadow != null
  const { host: rpHost, onLayout: rpLayout, start: rpStart, end: rpEnd, layer: rpLayer } = useRipple(rippleColor, clip)
  return (
    <Pressable
      {...rest}
      ref={rpHost}
      disabled={disabled}
      onLayout={rpLayout}
      onPressIn={(e) => {
        rpStart(e)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        rpEnd()
        onPressOut?.(e)
      }}
      style={[!shadowed && styles.host, style]}
    >
      {children}
      {rpLayer}
    </Pressable>
  )
}

// 물결 하나. 자기 애니메이션 값을 따로 가져서 다른 물결과 섞이지 않는다
type RippleProps = Omit<RippleState, 'key'> & { w: number; h: number; fill: string; onDone: () => void }

function Ripple({ x, y, d, w, h, released, fill, onDone }: RippleProps) {
  const [r] = useState(() => new Animated.Value(0))
  const [opacity] = useState(() => new Animated.Value(1))
  const [faded] = useState(() => Animated.multiply(opacity, 0.12))
  useEffect(() => {
    Animated.timing(r, {
      toValue: d / 2,
      duration: motion.rippleIn.duration,
      easing: Easing.bezier(...motion.rippleIn.bezier),
      useNativeDriver: false,
    }).start()
  }, [r, d])

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
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: faded }]}>
      <Svg width={w} height={h}>
        <AnimatedCircle cx={x} cy={y} r={r} fill={fill} />
      </Svg>
    </Animated.View>
  )
}

const RADIUS_KEYS = ['borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const
const pickRadius = (s: ViewStyle): ViewStyle =>
  Object.fromEntries(RADIUS_KEYS.filter((k) => s[k] != null).map((k) => [k, s[k]])) as ViewStyle

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
  clip: { overflow: 'hidden' },
})
