import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/TabBar'
import { setBedInfo, useBedInfo } from '@/features/bed/bed'
import { sampleResv, setResvState, useResvState } from '@/features/resv/resv'
import { color, font, radius, shadow, space } from '@/theme/tokens'

import { DevSwitch } from './DevSwitch'

// 개발할 때만 쓰는 시험 도구 모음. 침대가 알려 줄 정보(침대 정보, 예약 상태)를 손으로 바꿔 화면을 확인한다.
// 앱은 이 폴더를 모른다(그 값만 바꾼다). 떼려면 src/dev 폴더와 src/app/_layout.tsx의 DevTools 두 줄을 지우면 되고,
// 떼어도 앱은 처음 값(시각을 아는, 버튼 있는 집 침대 · 예약 하나와 실패 기록 하나)으로 그대로 움직인다.
// README대로 시험 도구는 실제 앱에 넣지 않으므로 개발 빌드(__DEV__)에서만 그린다
export function DevTools() {
  const bed = useBedInfo()
  const resv = useResvState()
  const insets = useSafeAreaInsets()
  // 화면을 덜 가리도록 평소엔 "시험" 버튼만 보이고, 누르면 스위치들이 펼쳐진다
  const [open, setOpen] = useState(false)
  if (!__DEV__) return null
  const blocked = !!bed.ward && !bed.ward.alarmAllowed
  return (
    // 탭 막대 바로 위 오른쪽에 쌓아 띄운다. 빈 자리는 누름이 아래 화면으로 지나간다
    <View style={[styles.stack, { bottom: TAB_BAR_SPACE + insets.bottom }]} pointerEvents="box-none">
      {open && (
        <>
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
          {/* 예약 탭: 끄면 처음 예약(오후 11:10 잠 자세)이 돌아온다 */}
          <DevSwitch
            label="예약 없음"
            value={resv.item == null}
            onValueChange={(on) => setResvState({ item: on ? null : sampleResv().item })}
          />
          {/* 예약 탭: 지난 예약을 실행하지 못한 기록 카드 */}
          <DevSwitch
            label="실패 기록"
            value={resv.fail != null}
            onValueChange={(on) => setResvState({ fail: on ? sampleResv().fail : null })}
          />
        </>
      )}
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((o) => !o)}
        role="button"
        accessibilityLabel={open ? '시험 도구 접기' : '시험 도구 펼치기'}
      >
        <Text style={styles.toggleText}>{open ? '시험 접기' : '시험'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', right: 18, alignItems: 'flex-end', gap: space[6] },
  toggle: {
    paddingHorizontal: space[12],
    paddingVertical: space[6],
    borderRadius: radius[26],
    backgroundColor: color.card,
    boxShadow: shadow.card,
  },
  toggleText: { fontFamily: font.bold, fontSize: 13, color: color.red },
})
