import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'

import { color, font, motion, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'
import { useReduceMotion } from './useReduceMotion'

type Props = {
  name: string
  value: string
  open?: boolean
  onPress?: () => void
  // 펼친 칸 내용. 없으면 누르기만 하는 줄
  children?: React.ReactNode
}

// lrow · 목록 줄: 누르면 아래로 선택지 칸이 펼쳐진다.
// 두루마리처럼 내용은 제자리에 두고 칸 높이만 늘고 줄며, 오른쪽 화살표가 아래로 돈다
export function ExpandRow({ name, value, open = false, onPress, children }: Props) {
  const reduceMotion = useReduceMotion()
  const [shown] = useState(() => new Animated.Value(open ? 1 : 0))
  const [turn] = useState(() => new Animated.Value(open ? 1 : 0))
  // 펼친 칸의 제 높이(달력은 달마다 줄 수가 달라 다시 잰다)
  const [panelH, setPanelH] = useState(0)

  useEffect(() => {
    const to = open ? 1 : 0
    if (reduceMotion) {
      shown.setValue(to)
      turn.setValue(to)
      return
    }
    const panel = Animated.timing(shown, {
      toValue: to,
      duration: motion.rowPanel.duration,
      easing: Easing.bezier(...motion.rowPanel.bezier),
      useNativeDriver: false,
    })
    const arrow = Animated.timing(turn, {
      toValue: to,
      duration: motion.rowArrow.duration,
      easing: Easing.bezier(...motion.rowArrow.bezier),
      useNativeDriver: true,
    })
    panel.start()
    arrow.start()
    return () => {
      panel.stop()
      arrow.stop()
    }
  }, [open, reduceMotion, shown, turn])

  return (
    <View style={styles.row}>
      <RippleButton
        style={styles.button}
        onPress={onPress}
        accessibilityLabel={`${name} ${value}`}
        accessibilityState={children ? { expanded: open } : undefined}
      >
        <Text style={[styles.name, styles.key]}>{name}</Text>
        <Text style={styles.value}>{value}</Text>
        <Animated.View
          style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}
        >
          <Image source={require('../../assets/icons/chevron.svg')} style={styles.icon20} />
        </Animated.View>
      </RippleButton>
      {children && (
        <Animated.View
          style={[styles.panel, { height: shown.interpolate({ inputRange: [0, 1], outputRange: [0, panelH] }) }]}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <View style={styles.panelIn} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
            {children}
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // 줄 사이 선은 아래쪽 1, 다음 줄과 겹쳐 한 줄로 보인다. 펼친 칸은 선 위에 들어간다
  row: { borderBottomWidth: 1, borderBottomColor: color.line, marginBottom: -1 },
  button: { height: 56, flexDirection: 'row', alignItems: 'center', gap: space[8], paddingHorizontal: space[16] },
  key: { flex: 1 },
  name: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  value: { fontFamily: font.medium, fontSize: 17, color: color.muted },
  icon20: { width: 20, height: 20 },
  panel: { overflow: 'hidden' },
  // rin · 펼친 칸: 아래 여백 12. 칸 높이와 상관없이 제 높이로 놓여 잴 수 있게 띄운다
  panelIn: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space[12] },
})
