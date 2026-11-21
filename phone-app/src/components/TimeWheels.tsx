import { LinearGradient } from 'expo-linear-gradient'
import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'

import { color, cssEase, font, radius, shadow } from '@/theme/tokens'

import { PullGestures } from './PullScroll'

const ROW = 48
const VISIBLE = 240
const PAD = (VISIBLE - ROW) / 2 // 가운데 줄 위아래 여백 96
// 놓을 때 빠르기(px/s)에 이 시간(초)을 곱한 만큼 더 미끄러진 뒤 가까운 줄에 멈춘다
const THROW = 0.25
// 끝없이 도는 바퀴에서 한 벌 앞뒤에 덧붙여 그리는 칸 수(가운데 줄 위 2칸, 아래 2칸 + 넘어가는 1칸)
const LEAD = 2
const TAIL = 3

const AP = ['오전', '오후']
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

type Props = {
  // 자정부터 센 분(0~1439)
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
}

// 피그마 "wheels · 시간 바퀴": 오전/오후 · 시 · 분 세 바퀴. 가운데 흰 줄이 고른 값
export function TimeWheels({ value, onChange, disabled }: Props) {
  const ap = value < 720 ? 0 : 1
  const h = (Math.floor(value / 60) + 11) % 12 // 1시 → 0, 12시 → 11
  const m = value % 60

  // 두 바퀴가 거의 같이 멈춰도 앞 바퀴 값을 잃지 않게 마지막 값을 기준으로 바꾼다
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])
  const set = (next: { ap?: number; h?: number; m?: number }) => {
    const cur = latest.current
    const a = next.ap ?? (cur < 720 ? 0 : 1)
    const hh = next.h ?? (Math.floor(cur / 60) + 11) % 12
    const mm = next.m ?? cur % 60
    const t = (((hh + 1) % 12) + (a ? 12 : 0)) * 60 + mm
    if (t === cur) return
    latest.current = t
    onChange(t)
  }

  return (
    <View style={styles.box} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.pick} pointerEvents="none" />
      <Wheel label="오전 오후" items={AP} index={ap} loop={false} disabled={!!disabled} onPick={(i) => set({ ap: i })} />
      <Wheel label="시" items={HOURS} index={h} loop disabled={!!disabled} onPick={(i) => set({ h: i })} />
      <Wheel label="분" items={MINUTES} index={m} loop disabled={!!disabled} onPick={(i) => set({ m: i })} />
    </View>
  )
}

type WheelProps = {
  label: string
  items: string[]
  index: number
  loop: boolean
  disabled: boolean
  onPick: (i: number) => void
}

const mod = (a: number, n: number) => ((a % n) + n) % n

// 바퀴 하나의 위치·손동작. 처음 한 번 만들어 계속 쓴다(그릴 때 읽지 않는다)
function makeWheel(n: number, loop: boolean, index: number) {
  // pos: 가운데 줄에 온 칸 번호 × ROW. 시·분은 끝없이 커지거나 작아질 수 있고, 보이는 값은 n으로 나눈 나머지
  const pos = new Animated.Value(index * ROW)
  const s = { now: index * ROW, start: 0, ended: false, pick: (_: number) => {} }

  // 칸 번호 row로 굴러가 멈추고, 멈추면 그 값으로 정한다
  const glide = (row: number) => {
    const goal = (loop ? row : Math.max(0, Math.min(n - 1, row))) * ROW
    const dist = Math.abs(goal - s.now)
    Animated.timing(pos, {
      toValue: goal,
      duration: Math.max(180, Math.min(700, 160 + dist * 1.2)),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) s.pick(mod(Math.round(goal / ROW), n))
    })
  }

  const gesture = (outer: GestureType[] | null, disabled: boolean) => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!disabled)
      .activeOffsetY([-2, 2])
      .onBegin(() => {
        s.ended = false
        pos.stopAnimation()
        s.start = s.now
      })
      .onUpdate((e) => {
        let p = s.start - e.translationY
        // 오전·오후는 끝에서 더 끌면 덜 따라온다
        if (!loop) {
          const max = (n - 1) * ROW
          if (p < 0) p = p / 3
          else if (p > max) p = max + (p - max) / 3
        }
        pos.setValue(p)
      })
      .onEnd((e) => {
        s.ended = true
        glide(Math.round((s.now - e.velocityY * THROW) / ROW))
      })
      .onFinalize(() => {
        // 끌지 않고 끝났거나 취소되면 가까운 줄로
        if (!s.ended) glide(Math.round(s.now / ROW))
      })
    // 누른 숫자로 굴러간다
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(!disabled)
      .onEnd((e) => {
        const k = Math.round((e.y - PAD - ROW / 2) / ROW)
        glide(Math.round(s.now / ROW) + k)
      })
    if (outer) {
      pan.blocksExternalGesture(...outer)
      tap.blocksExternalGesture(...outer)
    }
    return Gesture.Race(pan, tap)
  }

  // 밖에서 값이 바뀌면 그 자리로 옮긴다(굴려서 바뀐 값이면 이미 그 자리). 시·분은 지금 바퀴 둘레에서 가장 가까운 같은 값으로
  const follow = (i: number) => {
    const cur = Math.round(s.now / ROW)
    if (mod(cur, n) === i) return
    pos.stopAnimation()
    pos.setValue(loop ? (cur - mod(cur, n) + i) * ROW : i * ROW)
  }

  return {
    pos,
    gesture,
    follow,
    setNow: (v: number) => void (s.now = v),
    setPick: (fn: (i: number) => void) => void (s.pick = fn),
  }
}

// 바퀴 하나. 폰 기본 스크롤 칸을 쓰지 않고 손동작 하나가 직접 굴린다.
// - 바퀴 위에서 시작한 터치는 놓을 때까지 바퀴만 움직인다(바깥 시트의 스크롤·당김을 막는다)
// - 손가락이 바퀴 칸을 벗어나도 계속 따라온다
// - 놓으면 던진 빠르기만큼 미끄러져 가까운 줄에 멈춘다. 시·분은 끝없이 돈다
const Wheel = memo(function Wheel({ label, items, index, loop, disabled, onPick }: WheelProps) {
  const n = items.length
  const span = n * ROW
  const [w] = useState(() => makeWheel(n, loop, index))
  const pos = w.pos
  const [at, setAt] = useState(index)
  const atRef = useRef(index)

  useEffect(() => {
    w.setPick(onPick)
  }, [w, onPick])

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      w.setNow(value)
      const v = mod(Math.round(value / ROW), n)
      if (v !== atRef.current) {
        atRef.current = v
        setAt(v)
      }
    })
    return () => pos.removeListener(id)
  }, [w, pos, n])

  useEffect(() => {
    w.follow(index)
  }, [w, index])

  const outer = useContext(PullGestures)
  const gesture = useMemo(() => w.gesture(outer, disabled), [w, outer, disabled])

  // 시·분은 같은 값을 세 벌 이어 그리고, 가운데 벌이 늘 가운데 줄에 오게 둘레로 나눈 나머지만큼 옮긴다
  // 시·분은 한 벌 앞뒤에 끝 2칸·처음 3칸을 덧붙여 그리고(가운데 줄 위로 2칸, 아래로 2칸 + 넘어가는 1칸이 보인다),
  // 둘레로 나눈 나머지만큼 옮겨 끝없이 도는 것처럼 보인다. 세 벌을 그릴 때와 보이는 모습은 같다
  const rows = loop ? [...items.slice(n - LEAD), ...items, ...items.slice(0, TAIL)] : items
  const lead = loop ? LEAD : 0
  const shift = loop
    ? Animated.subtract(PAD - LEAD * ROW, Animated.modulo(pos, span))
    : Animated.subtract(PAD, pos)

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.wheel} role="list" accessibilityLabel={label} collapsable={false}>
        <Animated.View style={{ transform: [{ translateY: shift }] }}>
          {rows.map((v, i) => (
            <WheelItem key={i} v={v} on={mod(i - lead, n) === at} />
          ))}
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={[color.inset, 'rgba(240, 234, 230, 0)']} style={[styles.fade, styles.fadeTop]} />
        <LinearGradient pointerEvents="none" colors={['rgba(240, 234, 230, 0)', color.inset]} style={[styles.fade, styles.fadeBottom]} />
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    height: VISIBLE,
    backgroundColor: color.inset,
    borderRadius: radius[24],
    overflow: 'hidden',
  },
  // wheels::before · 고른 줄
  pick: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PAD,
    height: ROW,
    borderRadius: radius[16],
    backgroundColor: color.card,
    boxShadow: shadow.wheelPick,
  },
  wheel: { flex: 1, height: VISIBLE, overflow: 'hidden' },
  item: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  itemOn: { fontFamily: font.semiBold, fontSize: 30, color: color.fg },
  itemOff: { fontFamily: font.regular, fontSize: 24, color: color.muted },
  // fade · 흐림 띠
  fade: { position: 'absolute', left: 0, right: 0, height: 72 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
})

const EASE = Easing.bezier(...cssEase)

// 바퀴 한 줄. 가운데 줄이 되거나 벗어나면 글자 크기와 색이 0.15초 동안 바뀐다(시안 .witem transition: color .15s, font-size .15s)
const WheelItem = memo(function WheelItem({ v, on }: { v: string; on: boolean }) {
  const [k] = useState(() => new Animated.Value(on ? 1 : 0))
  // 처음 그릴 때는 이미 그 모습이라 움직이지 않는다(시트가 뜰 때 칸마다 헛도는 움직임을 시작하지 않게)
  const was = useRef(on)
  useEffect(() => {
    if (was.current === on) return
    was.current = on
    Animated.timing(k, { toValue: on ? 1 : 0, duration: 150, easing: EASE, useNativeDriver: false }).start()
  }, [on, k])
  return (
    <View role="listitem" accessibilityState={{ selected: on }} style={styles.item}>
      <Animated.Text
        style={[
          on ? styles.itemOn : styles.itemOff,
          {
            fontSize: k.interpolate({ inputRange: [0, 1], outputRange: [24, 30] }),
            color: k.interpolate({ inputRange: [0, 1], outputRange: [color.muted, color.fg] }),
          },
        ]}
      >
        {v}
      </Animated.Text>
    </View>
  )
})
