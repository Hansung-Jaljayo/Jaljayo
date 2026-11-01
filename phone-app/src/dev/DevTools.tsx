import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/TabBar'
import { setBedInfo, useBedInfo } from '@/features/bed/bed'
import { space } from '@/theme/tokens'

import { DevSwitch } from './DevSwitch'

// 개발할 때만 쓰는 시험 도구 모음. 침대가 알려 줄 정보를 손으로 바꿔 화면을 확인한다.
// 앱은 이 폴더를 모른다(침대 정보만 바꾼다). 떼려면 src/dev 폴더와 src/app/_layout.tsx의 DevTools 두 줄을 지우면 되고,
// 떼어도 앱은 침대 정보의 처음 값(시각을 아는, 버튼 있는 집 침대)으로 그대로 움직인다.
// README대로 시험 도구는 실제 앱에 넣지 않으므로 개발 빌드(__DEV__)에서만 그린다
export function DevTools() {
  const bed = useBedInfo()
  const insets = useSafeAreaInsets()
  if (!__DEV__) return null
  const blocked = !!bed.ward && !bed.ward.alarmAllowed
  return (
    // 탭 막대 바로 위 오른쪽에 쌓아 띄운다. 빈 자리는 누름이 아래 화면으로 지나간다
    <View style={[styles.stack, { bottom: TAB_BAR_SPACE + insets.bottom }]} pointerEvents="box-none">
      {/* 침대가 지금 시각을 모르는 상태: 알람·예약 탭에 시계 무효 띠가 뜬다 */}
      <DevSwitch label="시각 모름" value={!bed.clockOk} onValueChange={(on) => setBedInfo({ clockOk: !on })} />
      <DevSwitch
        label="버튼 없는 침대"
        value={!bed.hasButton}
        onValueChange={(on) => setBedInfo({ hasButton: !on })}
      />
      {/* 병원용 침대(사과 침대)로 바꾸고 병원에서 알람을 막는다. 끄면 집 침대로 돌아간다 */}
      <DevSwitch
        label="병원에서 알람을 막음"
        value={blocked}
        onValueChange={(on) => setBedInfo({ ward: on ? { name: '사과', alarmAllowed: false } : null })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', right: 18, alignItems: 'flex-end', gap: space[6] },
})
