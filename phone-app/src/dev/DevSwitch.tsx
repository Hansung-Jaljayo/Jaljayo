import { StyleSheet, Text, View } from 'react-native'

import { Switch } from '@/components/Switch'
import { color, font, radius, shadow, space } from '@/theme/tokens'

type Props = {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
}

// 시험용 스위치 한 줄. 자리는 DevTools가 정한다
export function DevSwitch({ label, value, onValueChange }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.tag}>시험</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={`시험: ${label}`} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
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
