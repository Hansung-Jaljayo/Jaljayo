import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Switch } from '@/components/Switch'
import { TAB_BAR_SPACE } from '@/components/TabBar'
import { color, font, radius, shadow, space } from '@/theme/tokens'

type Props = {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
}

// 시험용 스위치 한 줄(탭 막대 바로 위 오른쪽). DevTools에서만 쓴다.
// README대로 시험 도구는 실제 앱에 넣지 않으므로 개발 빌드(__DEV__)에서만 그린다
export function DevSwitch({ label, value, onValueChange }: Props) {
  const insets = useSafeAreaInsets()
  if (!__DEV__) return null
  return (
    <View style={[styles.box, { bottom: TAB_BAR_SPACE + insets.bottom }]}>
      <Text style={styles.tag}>시험</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={`시험: ${label}`} />
    </View>
  )
}

const styles = StyleSheet.create({
  // 탭 막대 바로 위 오른쪽에 떠 있다
  box: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingVertical: space[6],
    paddingLeft: space[12],
    paddingRight: space[6],
    borderRadius: radius[26],
    backgroundColor: color.card,
    boxShadow: shadow.card,
  },
  tag: { fontFamily: font.bold, fontSize: 13, color: color.red },
  label: { fontFamily: font.semiBold, fontSize: 15, color: color.fg },
})
