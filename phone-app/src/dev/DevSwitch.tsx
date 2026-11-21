import { StyleSheet, Text, View } from 'react-native'

import { Switch } from '@/components/Switch'
import { color, font, space } from '@/theme/tokens'

type Props = {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
}

// 시험용 스위치 한 줄. 자리는 DevTools가 정한다
export function DevSwitch({ label, value, onValueChange }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={`시험: ${label}`} />
    </View>
  )
}

const styles = StyleSheet.create({
  // 판 안의 목록 한 줄: 이름 왼쪽, 스위치 오른쪽
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  label: { flex: 1, fontFamily: font.medium, fontSize: 15, color: color.fg },
})
