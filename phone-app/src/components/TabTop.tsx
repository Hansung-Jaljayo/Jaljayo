import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { bedName, useBedInfo } from '@/features/bed/bed'
import { color, font, radius, shadow, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'

type Props = {
  // 오른쪽 위 설정 버튼. 설정 화면이 생기면 연결한다
  onGear?: () => void
}

// 모든 탭 맨 위 머리: 침대 사진 · 연결 상태 · 침대 이름(병원용이면 "사과 침대"), 오른쪽 설정 버튼
export function TabTop({ onGear }: Props) {
  const bed = useBedInfo()
  return (
    <View style={styles.top}>
      <View style={styles.who}>
        <Image source={require('../../assets/images/logo.png')} style={styles.photo} accessibilityLabel="잘자요 로고" />
        <View>
          <View style={styles.state}>
            <View style={styles.dot} />
            <Text style={styles.stateText}>연결됨</Text>
          </View>
          <Text style={styles.name}>{bedName(bed)}</Text>
        </View>
      </View>
      {/* 그림자가 잘리지 않게 바깥 칸에 그림자, 안쪽 버튼에 물결 */}
      <View style={styles.gearShadow}>
        <RippleButton style={styles.gear} onPress={onGear} accessibilityLabel="설정">
          <Image source={require('../../assets/icons/gear.svg')} style={styles.icon22} />
        </RippleButton>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  top: {
    height: 50,
    paddingTop: space[4],
    paddingBottom: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  photo: { width: 36, height: 36 },
  state: { height: 16, flexDirection: 'row', alignItems: 'center', gap: space[6] },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color['accent-strong'] },
  stateText: { fontFamily: font.medium, fontSize: 13, color: color.muted },
  // 연결 상태 줄과 1 겹친다(피그마 top 15)
  name: { marginTop: -1, fontFamily: font.semiBold, fontSize: 20, letterSpacing: -0.6, color: color.fg },
  gearShadow: { borderRadius: radius[22], boxShadow: shadow.card },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius[22],
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon22: { width: 22, height: 22 },
})
