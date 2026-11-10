import { useEffect, useState } from 'react'
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

// 끝까지 당기면 내용이 손을 따라 밀렸다가 놓으면 튕겨 돌아오는 세로 스크롤 칸.
// 아이폰은 기본 동작을 그대로 쓰고, 갤럭시는 기본(고무처럼 늘어남)을 끄고 아이폰처럼 튕기게 직접 만든다
// ref로 스크롤 칸을 직접 움직일 수 있다(scrollToEnd 등)
type Props = ScrollViewProps & { ref?: React.Ref<ScrollViewInstance> }

export function PullScroll(props: Props) {
  if (Platform.OS !== 'android') return <ScrollView alwaysBounceVertical {...props} />
  return <AndroidBounce {...props} />
}

// 아이폰과 같은 당김 저항: 많이 당길수록 덜 따라온다(d는 칸 높이)
const K = 0.55
const rubber = (x: number, d: number) => (1 - 1 / ((Math.abs(x) * K) / d + 1)) * d * Math.sign(x)
// 밀려 있는 거리 r이 되려면 손가락을 얼마나 당겨야 하는지(rubber의 반대)
const unrubber = (r: number, d: number) => {
  const a = Math.min(Math.abs(r), d * 0.99)
  return ((a / (d - a)) * d * Math.sign(r)) / K
}
// 놓으면 0.48초 동안 감속하며 제자리로(시안 OverPull.back의 아이폰 값: 1 - (1 - p)³)
const back = (v: Animated.Value) => Animated.timing(v, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true })

// 손가락·스크롤 상태와 손동작은 처음 한 번 만들어 계속 쓴다(그릴 때 읽지 않는다)
function makeBounce() {
  const pull = new Animated.Value(0)
  const s = {
    y: 0,
    t: 0,
    v: 0,
    viewH: 0,
    contentH: 0,
    startY: 0,
    anchor: null as number | null,
    edge: 0,
    touching: false,
    flinging: false,
    enabled: true,
  }
  const maxY = () => Math.max(0, s.contentH - s.viewH)
  const native = Gesture.Native()
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-4, 4])
    .failOffsetX([-16, 16])
    .simultaneousWithExternalGesture(native)
    .onBegin(() => {
      s.touching = true
      s.flinging = false
    })
    .onStart((e) => {
      s.startY = e.absoluteY
      s.anchor = null
      s.edge = 0
      // 돌아가는 중에 다시 잡으면 그 자리에서 이어 당긴다
      pull.stopAnimation((v) => {
        if (Math.abs(v) > 0.5) {
          s.edge = Math.sign(v)
          s.anchor = e.absoluteY - unrubber(v, s.viewH || 600)
        }
      })
    })
    .onUpdate((e) => {
      if (!s.enabled) return
      const y = e.absoluteY
      if (s.anchor == null) {
        // 끝에 닿은 뒤 끝 바깥쪽으로 더 끄는 순간부터 당김을 센다
        const atTop = s.y <= 0.5,
          atBottom = s.y >= maxY() - 0.5
        if (atTop && y > s.startY) {
          s.anchor = s.startY
          s.edge = 1
        } else if (atBottom && y < s.startY) {
          s.anchor = s.startY
          s.edge = -1
        } else {
          s.startY = y
          return
        }
      }
      const d = y - s.anchor
      if ((s.edge > 0 && d <= 0) || (s.edge < 0 && d >= 0)) {
        // 반대로 밀어 끝에서 벗어나면 다시 보통 스크롤
        s.anchor = null
        s.startY = y
        pull.setValue(0)
        return
      }
      pull.setValue(rubber(d, s.viewH || 600))
    })
    .onFinalize(() => {
      s.touching = false
      s.anchor = null
      back(pull).start()
    })

  // 빠르게 튕겨 넘기다 끝에 닿으면 그 빠르기만큼 넘쳤다가 돌아온다(아이폰처럼)
  const kick = (dir: 1 | -1) => {
    s.flinging = false
    const amount = Math.min(90, Math.max(12, Math.abs(s.v) * 28))
    Animated.sequence([
      Animated.timing(pull, { toValue: dir * amount, duration: 110, useNativeDriver: true }),
      back(pull),
    ]).start()
  }
  const scrolled = (y: number, t: number) => {
    if (s.t) s.v = (y - s.y) / Math.max(1, t - s.t)
    s.t = t
    s.y = y
    if (s.flinging && !s.touching) {
      if (y <= 0.5 && s.v < 0) kick(1)
      else if (y >= maxY() - 0.5 && s.v > 0) kick(-1)
    }
  }
  // 칸이 알려 주는 값들
  const set = {
    enabled: (on: boolean) => void (s.enabled = on),
    viewH: (h: number) => void (s.viewH = h),
    contentH: (h: number) => void (s.contentH = h),
    momentum: (on: boolean) => void (s.flinging = on && !s.touching),
  }
  return { pull, pan, native, scrolled, set }
}

function AndroidBounce({
  style,
  onScroll,
  onLayout,
  onContentSizeChange,
  onMomentumScrollBegin,
  onMomentumScrollEnd,
  children,
  ...rest
}: Props) {
  const [b] = useState(makeBounce)
  const enabled = rest.scrollEnabled !== false
  useEffect(() => {
    b.set.enabled(enabled)
  }, [b, enabled])

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    b.scrolled(e.nativeEvent.contentOffset.y, e.timeStamp)
    onScroll?.(e)
  }

  return (
    <GestureDetector gesture={b.pan}>
      <GestureDetector gesture={b.native}>
        <Animated.ScrollView
          {...rest}
          // 기본 당김 모양(늘어남)은 끈다
          overScrollMode="never"
          style={[style, { transform: [{ translateY: b.pull }] }]}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onLayout={(e: LayoutChangeEvent) => {
            b.set.viewH(e.nativeEvent.layout.height)
            onLayout?.(e)
          }}
          onContentSizeChange={(w, h) => {
            b.set.contentH(h)
            onContentSizeChange?.(w, h)
          }}
          onMomentumScrollBegin={(e) => {
            b.set.momentum(true)
            onMomentumScrollBegin?.(e)
          }}
          onMomentumScrollEnd={(e) => {
            b.set.momentum(false)
            onMomentumScrollEnd?.(e)
          }}
        >
          {children}
        </Animated.ScrollView>
      </GestureDetector>
    </GestureDetector>
  )
}
