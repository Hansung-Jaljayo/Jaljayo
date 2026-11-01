import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { color, font, shadow, space } from '@/theme/tokens'

type Props = {
  title: string
  // 문장마다 줄을 나눈다
  lines: string[]
}

// 피그마 "aoff · 꺼짐 안내": 알람을 쓸 수 없을 때 알람 탭 머리 아래를 채우는 안내(가운데 아이콘·제목·설명).
// "알람 탭 / 버튼 없는 침대 안내"에서 쓴다
export function AlarmOff({ title, lines }: Props) {
  return (
    <View style={styles.box}>
      {/* ic · 아이콘: 피그마는 시계 고리와 바늘·빗금 두 층이라 42 칸 안 같은 자리에 겹쳐 둔다 */}
      <View style={styles.ic}>
        <View style={styles.icon42}>
          <Image source={require('../../../assets/icons/alarm-off-ring.svg')} style={styles.ring} />
          <Image source={require('../../../assets/icons/alarm-off-marks.svg')} style={styles.marks} />
        </View>
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
  ring: { position: 'absolute', left: 7.85, top: 9.6, width: 26.3, height: 26.3 },
  marks: { position: 'absolute', left: 4.35, top: 4.35, width: 33.3, height: 33.3 },
  title: { marginTop: space[6], fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.48, color: color.fg, textAlign: 'center' },
  text: { fontFamily: font.regular, fontSize: 17, lineHeight: 25.5, color: color['fg-2'], textAlign: 'center' },
})
