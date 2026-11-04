import { StyleSheet, Text } from 'react-native'

import { useBedInfo } from '@/features/bed/bed'
import { color, font, radius, space } from '@/theme/tokens'

// 피그마 "tban · 시계 무효 띠": 침대가 지금 시각을 모르면 알람·예약 탭 머리 바로 아래에 띄운다.
// 침대 정보를 스스로 읽으므로 탭에서는 놓기만 하면 된다
export function ClockBand() {
  const { clockOk } = useBedInfo()
  if (clockOk) return null
  return (
    <Text style={styles.band} role="alert">
      지금은 알람과 예약이 실행되지 않아요. 침대와 연결해 시계를 맞춰 주세요.
    </Text>
  )
}

const styles = StyleSheet.create({
  band: {
    paddingHorizontal: space[16],
    paddingVertical: 14,
    borderRadius: radius[22],
    overflow: 'hidden',
    backgroundColor: color.warnBg,
    fontFamily: font.semiBold,
    fontSize: 15,
    lineHeight: 22.5,
    color: color.warnFg,
  },
})
