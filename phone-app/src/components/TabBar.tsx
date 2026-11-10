import { Image } from 'expo-image'
import { useState } from 'react'
import { Animated, Platform, StyleSheet, Text, View } from 'react-native'
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
  // 넘김 판의 위치(0 자세, 1 알람, 2 예약). 알약이 손가락을 그대로 따라간다
  position: Animated.AnimatedInterpolation<number> | Animated.Value
  onPick?: (key: TabKey) => void
  // 쓸 수 없는 탭(예: 버튼 없는 침대의 알람). 고른 표시는 그대로 두고 그림과 글만 흐리게(40%)
  dimmed?: TabKey[]
}

// 피그마 "tabs · 아래 탭 막대". 화면 아래에 떠 있는 둥근 막대.
// 시안: 짙은 알약이 넘긴 정도를 그대로 따라가고, 알약 위 글자는 밝은 글자 한 벌을 알약 모양대로 잘라 겹친다
// (알약이 반만 덮어도 덮인 쪽만 밝게 보인다)
export function TabBar({ current, position, onPick, dimmed = [] }: Props) {
  const insets = useSafeAreaInsets()
  const [w, setW] = useState(0)
  // 탭 한 칸 폭: 막대 안 여백 8씩, 칸 사이 4
  const tw = w ? (w - 16 - 8) / 3 : 0
  const pillX = Animated.add(8, Animated.multiply(position, tw + 4))
  const back = Animated.multiply(pillX, -1)
  const row = (lit: boolean) =>
    TABS.map((t) => {
      const dim = dimmed.includes(t.key) && styles.dim
      return (
        <View key={t.key} style={[styles.tabIn, { width: tw }]}>
          <Image source={(lit && t.iconOn) || t.icon} style={[styles.icon22, dim]} />
          <Text style={[styles.name, lit && styles.nameOn, dim]}>{t.name}</Text>
        </View>
      )
    })
  // 시안: 아이폰은 화면 아래에서 30(홈 막대 위), 갤럭시는 아래 버튼 막대 위 12
  return (
    <View
      style={[styles.bar, { bottom: Platform.OS === 'ios' ? Math.max(insets.bottom - 4, 12) : insets.bottom + 12 }]}
      role="tablist"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {TABS.map((t) => (
        <RippleButton
          key={t.key}
          role="tab"
          accessibilityLabel={t.name}
          accessibilityState={{ selected: t.key === current }}
          style={styles.tab}
          rippleColor={color.muted}
          onPress={() => onPick?.(t.key)}
        >
          {row(false).find((x) => x.key === t.key)}
        </RippleButton>
      ))}
      {tw > 0 && (
        <Animated.View pointerEvents="none" style={[styles.pill, { width: tw, transform: [{ translateX: pillX }] }]}>
          <Animated.View style={[styles.inkRow, { transform: [{ translateX: back }] }]}>{row(true)}</Animated.View>
        </Animated.View>
      )}
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
  tabIn: { height: 52, alignItems: 'center', justifyContent: 'center', gap: 1.5 },
  // 짙은 알약(높이 52, 위아래 8). 안에 밝은 글자 한 벌을 거꾸로 밀어 넣어 탭 자리에 맞춘다
  pill: { position: 'absolute', left: 0, top: 8, height: 52, borderRadius: radius[26], backgroundColor: color.ink, overflow: 'hidden' },
  inkRow: { position: 'absolute', left: 8, top: 0, flexDirection: 'row', gap: space[4] },
  icon22: { width: 22, height: 22 },
  dim: { opacity: 0.4 },
  name: { fontFamily: font.semiBold, fontSize: 13, lineHeight: 16, color: color.muted },
  nameOn: { color: color['on-ink'] },
})
