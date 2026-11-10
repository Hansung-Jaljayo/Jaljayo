import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  Easing,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, motion, radius, cssEase } from '@/theme/tokens'

import { Portal } from './Portal'
import { PullScroll } from './PullScroll'
import { useReduceMotion } from './useReduceMotion'

// 시안 CSS ease
const EASE = Easing.bezier(...cssEase)

type Props = {
  open: boolean
  onClose: () => void
  // 키가 큰 시트(알람 창): 상태 표시줄 바로 아래 8까지 올라온다
  tall?: boolean
  // 시트 최대 높이를 "화면 높이 - 이 값"으로(자세 각도 시트는 56). 없으면 화면의 78%
  topGap?: number
  // 켜지면 맨 아래로 내린다(저장 실패 안내와 다시 시도 버튼이 화면 밖에 남지 않게)
  toEnd?: boolean
  children: React.ReactNode
}

const openEase = Easing.bezier(...motion.sheetOpen.bezier)
const closeEase = Easing.bezier(...motion.sheetClose.bezier)

// 아래에서 올라오는 창. 어두운 바탕을 누르거나, 손잡이를 80 넘게 끌어내리거나, 뒤로 가기를 누르면 닫힌다.
// 시안처럼 어두운 바탕(0.4초)과 시트(열기 0.5초·닫기 0.35초)는 따로 움직이고, 시트는 자기 높이의 105%만큼 아래에서 올라온다
export function BottomSheet({ open, onClose, tall, topGap, toEnd, children }: Props) {
  const insets = useSafeAreaInsets()
  const { height: screenH } = useWindowDimensions()
  // 닫히는 움직임이 끝날 때까지는 그려 둔다
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const reduceMotion = useReduceMotion()

  // 시트 높이(그려진 뒤에 안다). 알기 전에는 화면 밖에 둔다
  const [sheetH, setSheetH] = useState(0)
  const [back] = useState(() => new Animated.Value(0))
  // 시트가 아래로 밀린 거리. 손잡이 끌기도 이 값을 바로 바꾼다
  const [y] = useState(() => new Animated.Value(screenH))
  const [fade] = useState(() => new Animated.Value(1))
  const shownOnce = useRef(false)
  // 손잡이를 놓은 횟수(놓을 때마다 열린 자리로 돌아갈지 본다)
  const [released, setReleased] = useState(0)
  const hidden = (h: number) => (reduceMotion ? 24 : h * 1.05)
  const measured = sheetH > 0
  const scroll = useRef<ScrollViewInstance>(null)

  // 안내가 새로 붙은 뒤 높이가 바뀌고 나서 내린다
  useEffect(() => {
    if (!toEnd || !open) return
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduceMotion }), 60)
    return () => clearTimeout(t)
  }, [toEnd, open, reduceMotion])

  useEffect(() => {
    if (!mounted) return
    if (open && !measured) return
    const h = sheetH || screenH
    if (open && !shownOnce.current) {
      shownOnce.current = true
      y.setValue(hidden(h))
      fade.setValue(reduceMotion ? 0 : 1)
    }
    const dur = reduceMotion ? (open ? 400 : 300) : open ? motion.sheetOpen.duration : motion.sheetClose.duration
    const ease = reduceMotion ? EASE : open ? openEase : closeEase
    const anims = [
      Animated.timing(back, { toValue: open ? 1 : 0, duration: motion.backdrop.duration, easing: EASE, useNativeDriver: true }),
      Animated.timing(y, { toValue: open ? 0 : hidden(h), duration: dur, easing: ease, useNativeDriver: true }),
    ]
    if (reduceMotion) anims.push(Animated.timing(fade, { toValue: open ? 1 : 0, duration: dur, easing: EASE, useNativeDriver: true }))
    Animated.parallel(anims).start(({ finished }) => {
      if (finished && !open) {
        shownOnce.current = false
        setSheetH(0)
        setMounted(false)
      }
    })
    // 열린 동안 높이가 바뀌어도(줄이 펼쳐짐 등) 다시 올라오는 움직임은 하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, measured, reduceMotion])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [open, onClose])

  // 놓으면 열린 자리로 돌아간다. 닫기를 불렀는데 부모가 닫지 않으면(저장 중 등) 그때도 돌아간다
  useEffect(() => {
    if (!released || !open) return
    Animated.timing(y, { toValue: 0, duration: motion.sheetOpen.duration, easing: openEase, useNativeDriver: true }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [released])

  const grab = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => y.stopAnimation(),
        onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80) onClose()
          setReleased((n) => n + 1)
        },
        onPanResponderTerminate: () => setReleased((n) => n + 1),
      }),
    [y, onClose],
  )

  if (!mounted) return null

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    if (h && Math.abs(h - sheetH) > 0.5) setSheetH(h)
  }
  const top = tall ? insets.top + 8 : undefined
  const maxHeight = tall ? undefined : topGap != null ? screenH - topGap : '78%'

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: back }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        </Animated.View>
        <Animated.View
          role="dialog"
          aria-modal
          onLayout={onLayout}
          style={[styles.sheet, tall ? { top } : { maxHeight }, { opacity: fade, transform: [{ translateY: y }] }]}
        >
          <View style={styles.grab} {...grab.panHandlers}>
            <View style={styles.grabBar} />
          </View>
          {/* 끝까지 당기면 내용이 짧아도 튕긴다(갤럭시도 아이폰처럼) */}
          <PullScroll
            ref={scroll}
            contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </PullScroll>
        </Animated.View>
      </View>
    </Portal>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: color.backdrop },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.card,
    borderTopLeftRadius: radius[30],
    borderTopRightRadius: radius[30],
    overflow: 'hidden',
  },
  // 손잡이 칸: 위 4, 높이 20, 그 아래 묶음 사이 16
  grab: { marginTop: 4, marginHorizontal: 18, height: 20, alignItems: 'center', justifyContent: 'center' },
  grabBar: { width: 44, height: 5, borderRadius: radius[3], backgroundColor: color.grab },
  content: { paddingTop: 16, paddingHorizontal: 18, gap: 16 },
})
