import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { color, font, shadow, space } from '@/theme/tokens'

type Props = {
  // 줄을 나누려면 \n
  title: string
  // 문장마다 줄을 나눈다
  lines: string[]
}

// 피그마 "aoff · 꺼짐 안내": 알람을 쓸 수 없을 때 알람 탭 머리 아래를 채우는 안내(가운데 아이콘·제목·설명).
// "알람 탭 / 버튼 없는 침대 안내"와 "알람 탭 / 병원에서 알람을 막음"에서 쓴다
export function AlarmOff({ title, lines }: Props) {
  return (
    <View style={styles.box}>
      {/* ic · 아이콘: 시안 그림(24 칸)을 42로 키운다. 선도 같이 굵어진다 */}
      <View style={styles.ic}>
        <Image source={require('../../../assets/icons/alarm-off.svg')} style={styles.icon42} />
      </View>
      <Text style={styles.title} role="heading">
        {title}
      </Text>
      <Text style={styles.text}>{lines.join('\n')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // 머리 아래 남은 자리 가운데. 아래 40은 탭 막대 쪽으로 쏠려 보이지 않게 띄운 것
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[12], paddingBottom: 40 },
  ic: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: color.card,
    boxShadow: shadow.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon42: { width: 42, height: 42 },
  title: { marginTop: space[6], fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.48, color: color.fg, textAlign: 'center' },
  text: { fontFamily: font.regular, fontSize: 17, lineHeight: 25.5, color: color['fg-2'], textAlign: 'center' },
})
