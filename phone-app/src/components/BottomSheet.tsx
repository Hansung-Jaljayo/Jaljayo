import { useEffect, useMemo, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, motion, radius } from '@/theme/tokens'

type Props = {
  open: boolean
  onClose: () => void
  // 키가 큰 시트(알람 창): 상태 표시줄 바로 아래 8까지 올라온다
  tall?: boolean
  children: React.ReactNode
}

// 아래에서 올라오는 창. 어두운 바탕을 누르거나, 손잡이를 80 넘게 끌어내리거나, 뒤로 가기를 누르면 닫힌다
export function BottomSheet({ open, onClose, tall, children }: Props) {
  const insets = useSafeAreaInsets()
  const { height: screenH } = useWindowDimensions()
  // 닫히는 움직임이 끝날 때까지는 그려 둔다
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [shown] = useState(() => new Animated.Value(open ? 1 : 0))
  const [drag] = useState(() => new Animated.Value(0))

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])

  useEffect(() => {
    // 닫힘은 조금 더 빠르게
    const m = open ? motion.sheetOpen : motion.sheetClose
    const ease = open ? Easing.bezier(...motion.sheetOpen.bezier) : Easing.bezier(...motion.sheetClose.bezier)
    Animated.timing(shown, {
      toValue: open ? 1 : 0,
      // 동작 줄이기를 켠 기기는 짧게 떠오르며 서서히 나타난다
      duration: reduceMotion ? (open ? 400 : 300) : m.duration,
      easing: reduceMotion ? Easing.ease : ease,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        setMounted(false)
        drag.setValue(0)
      }
    })
  }, [open, reduceMotion, shown, drag])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [open, onClose])

  const grab = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80) onClose()
          else Animated.timing(drag, { toValue: 0, duration: 250, useNativeDriver: true }).start()
        },
        onPanResponderTerminate: () =>
          Animated.timing(drag, { toValue: 0, duration: 250, useNativeDriver: true }).start(),
      }),
    [drag, onClose],
  )
  if (!mounted) return null

  const top = tall ? insets.top + 8 : undefined
  const slide = reduceMotion
    ? shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
    : shown.interpolate({ inputRange: [0, 1], outputRange: [screenH * 1.05, 0] })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      <Animated.View
        role="dialog"
        aria-modal
        style={[
          styles.sheet,
          tall ? { top } : { maxHeight: '78%' },
          {
            opacity: reduceMotion ? shown : 1,
            transform: [{ translateY: Animated.add(slide, drag) }],
          },
        ]}
      >
        <View style={styles.grab} {...grab.panHandlers}>
          <View style={styles.grabBar} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
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
