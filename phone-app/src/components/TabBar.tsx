import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, radius, shadow, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'

export type TabKey = 'pose' | 'alarm' | 'resv'

// 고른 탭은 진한 칸 위에 복숭아색 그림과 밝은 글자.
// 고른 모습의 그림은 피그마에 있는 알람·예약 탭 것만 받아 두었다(자세 탭을 만들 때 받는다)
const TABS: { key: TabKey; name: string; icon: number; iconOn?: number }[] = [
  {
    key: 'pose',
    name: '자세',
    icon: require('../../assets/icons/tab-pose.svg'),
    iconOn: require('../../assets/icons/tab-pose-on.svg'),
  },
  {
    key: 'alarm',
    name: '알람',
    icon: require('../../assets/icons/tab-alarm.svg'),
    iconOn: require('../../assets/icons/tab-alarm-on.svg'),
  },
  {
    key: 'resv',
    name: '예약',
    icon: require('../../assets/icons/tab-resv.svg'),
    iconOn: require('../../assets/icons/tab-resv-on.svg'),
  },
]

// 탭 막대 높이 68 + 아래 여백 12. 본문은 이만큼(+12) 아래를 비운다
export const TAB_BAR_SPACE = 92

type Props = {
  current: TabKey
  // 탭을 누르면. 아직 화면이 없는 탭(자세)은 눌러도 그대로다
  onPick?: (key: TabKey) => void
  // 쓸 수 없는 탭(예: 버튼 없는 침대의 알람). 고른 표시는 그대로 두고 그림과 글만 흐리게(40%)
  dimmed?: TabKey[]
}

// 피그마 "tabs · 아래 탭 막대". 화면 아래에 떠 있는 둥근 막대
export function TabBar({ current, onPick, dimmed = [] }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { bottom: insets.bottom + 12 }]} role="tablist">
      {TABS.map((t) => {
        const on = t.key === current
        const dim = dimmed.includes(t.key) && styles.dim
        return (
          <RippleButton
            key={t.key}
            role="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && styles.tabOn]}
            rippleColor={on ? color['on-ink'] : color.muted}
            onPress={() => onPick?.(t.key)}
          >
            <Image source={(on && t.iconOn) || t.icon} style={[styles.icon22, dim]} />
            <Text style={[styles.name, on && styles.nameOn, dim]}>{t.name}</Text>
          </RippleButton>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 68,
    paddingHorizontal: space[8],
    borderRadius: radius[34],
    backgroundColor: color.card,
    boxShadow: shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  tab: {
    flex: 1,
    height: 52,
    borderRadius: radius[26],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
  },
  tabOn: { backgroundColor: color.ink },
  icon22: { width: 22, height: 22 },
  dim: { opacity: 0.4 },
  name: { fontFamily: font.semiBold, fontSize: 13, lineHeight: 16, color: color.muted },
  nameOn: { color: color['on-ink'] },
})
