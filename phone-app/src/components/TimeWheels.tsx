import { LinearGradient } from 'expo-linear-gradient'
import { type ComponentRef, memo, useEffect, useRef, useState } from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { color, font, radius, shadow } from '@/theme/tokens'

const ROW = 48
const VISIBLE = 240
const PAD = (VISIBLE - ROW) / 2 // 가운데 줄 위아래 여백 96
// 시·분 바퀴는 같은 값을 7벌 이어 붙여 끝없이 도는 것처럼 보이게 하고, 멈추면 가운데 벌로 옮긴다
const LOOP = 7

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
      <Wheel label="오전 오후" items={AP} index={ap} loop={false} onPick={(i) => set({ ap: i })} />
      <Wheel label="시" items={HOURS} index={h} loop onPick={(i) => set({ h: i })} />
      <Wheel label="분" items={MINUTES} index={m} loop onPick={(i) => set({ m: i })} />
    </View>
  )
}

type WheelProps = {
  label: string
  items: string[]
  index: number
  loop: boolean
  onPick: (i: number) => void
}

const Wheel = memo(function Wheel({ label, items, index, loop, onPick }: WheelProps) {
  const n = items.length
  const base = loop ? Math.floor(LOOP / 2) * n : 0
  const all = loop ? Array.from({ length: LOOP }, () => items).flat() : items
  const ref = useRef<ComponentRef<typeof ScrollView>>(null)
  const [at, setAt] = useState(base + index)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const atRef = useRef(at)
  useEffect(() => {
    atRef.current = at
  }, [at])

  // 밖에서 값이 바뀌면 그 자리로 돌린다(굴려서 바뀐 값이면 이미 그 자리)
  useEffect(() => {
    if (((atRef.current % n) + n) % n === index) return
    const goal = base + index
    ref.current?.scrollTo({ y: goal * ROW, animated: false })
    setAt(goal)
  }, [index, base, n])

  useEffect(() => () => { if (settle.current) clearTimeout(settle.current) }, [])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(all.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW)))
    if (i !== atRef.current) setAt(i)
    // 굴리다 멈추면 그 값으로 정한다
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const v = ((i % n) + n) % n
      // 멈춘 자리가 가운데 벌에서 벗어났으면 같은 값의 가운데 벌 자리로 옮긴다(보이는 숫자는 그대로)
      if (loop && i !== base + v) {
        ref.current?.scrollTo({ y: (base + v) * ROW, animated: false })
        setAt(base + v)
      }
      onPick(v)
    }, 120)
  }

  return (
    <View style={styles.wheel} role="list" accessibilityLabel={label}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentOffset={{ x: 0, y: (base + index) * ROW }}
        onLayout={() => ref.current?.scrollTo({ y: atRef.current * ROW, animated: false })}
        contentContainerStyle={styles.track}
      >
        {all.map((v, i) => {
          const on = i === at
          return (
            <Pressable
              key={i}
              role="listitem"
              accessibilityState={{ selected: on }}
              style={styles.item}
              // 누른 숫자로 굴러간다
              onPress={() => ref.current?.scrollTo({ y: i * ROW, animated: true })}
            >
              <Text style={on ? styles.itemOn : styles.itemOff}>{v}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <LinearGradient pointerEvents="none" colors={[color.inset, 'rgba(240, 234, 230, 0)']} style={[styles.fade, styles.fadeTop]} />
      <LinearGradient pointerEvents="none" colors={['rgba(240, 234, 230, 0)', color.inset]} style={[styles.fade, styles.fadeBottom]} />
    </View>
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
  wheel: { flex: 1, height: VISIBLE },
  track: { paddingVertical: PAD },
  item: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  itemOn: { fontFamily: font.semiBold, fontSize: 30, color: color.fg },
  itemOff: { fontFamily: font.regular, fontSize: 24, color: color.muted },
  // fade · 흐림 띠
  fade: { position: 'absolute', left: 0, right: 0, height: 72 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
})
