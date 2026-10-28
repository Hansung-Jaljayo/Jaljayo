import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { RippleButton } from '@/components/RippleButton'
import { color, font, radius, space } from '@/theme/tokens'

import { DAY_NAMES, nowMinutes } from './alarm'

// 이번 달부터 석 달까지 넘겨 볼 수 있다
const LAST_MONTH = 2

type Props = {
  // 고른 날: 오늘부터 며칠 뒤
  value: number | null
  // 알람 시각(분). 오늘 그 시각이 이미 지났으면 오늘은 고를 수 없다
  time: number
  onPick: (off: number) => void
}

// cal · 한 달 달력(삼성 시계처럼): 지난 날은 흐리게, 고른 날은 복숭아색 원
export function DateCalendar({ value, time, onPick }: Props) {
  const [month, setMonth] = useState(0)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const first = new Date(today.getFullYear(), today.getMonth() + month, 1)
  const y = first.getFullYear()
  const m = first.getMonth()
  const count = new Date(y, m + 1, 0).getDate()
  const offOf = (d: number) => Math.round((new Date(y, m, d).getTime() - today.getTime()) / 864e5)
  const passed = time <= nowMinutes(now)

  // 1일 앞은 빈 칸, 7칸씩 한 주
  const cells: (number | null)[] = [...Array<null>(first.getDay()).fill(null)]
  for (let d = 1; d <= count; d++) cells.push(d)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const canPrev = month > 0
  const canNext = month < LAST_MONTH

  return (
    <View style={styles.cal}>
      {/* calh · 달력 머리 */}
      <View style={styles.head}>
        <RippleButton
          style={styles.monthButton}
          disabled={!canPrev}
          onPress={() => setMonth(month - 1)}
          accessibilityLabel="이전 달"
          accessibilityState={{ disabled: !canPrev }}
        >
          <Image
            source={
              canPrev
                ? require('../../../assets/icons/chevron-left.svg')
                : require('../../../assets/icons/chevron-left-off.svg')
            }
            style={styles.icon20}
          />
        </RippleButton>
        <Text style={styles.month}>
          {y}년 {m + 1}월
        </Text>
        <RippleButton
          style={styles.monthButton}
          disabled={!canNext}
          onPress={() => setMonth(month + 1)}
          accessibilityLabel="다음 달"
          accessibilityState={{ disabled: !canNext }}
        >
          <Image
            source={
              canNext
                ? require('../../../assets/icons/chevron-dark.svg')
                : require('../../../assets/icons/chevron-dark-off.svg')
            }
            style={styles.icon20}
          />
        </RippleButton>
      </View>

      {/* calw · 요일 */}
      <View style={styles.week}>
        {DAY_NAMES.map((name) => (
          <Text key={name} style={[styles.cell, styles.weekName]}>
            {name}
          </Text>
        ))}
      </View>

      {/* calg · 날짜 칸 */}
      <View style={styles.grid}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = week[i]
              if (d == null) return <View key={i} style={styles.cell} />
              const off = offOf(d)
              const disabled = off < 0 || (off === 0 && passed)
              const on = off === value
              return (
                <View key={i} style={styles.cell}>
                  <RippleButton
                    style={[styles.day, on && styles.dayOn]}
                    disabled={disabled}
                    onPress={() => onPick(off)}
                    accessibilityLabel={`${m + 1}월 ${d}일`}
                    accessibilityState={{ selected: on, disabled }}
                  >
                    <Text style={[styles.dayText, on && styles.dayTextOn, disabled && styles.dayTextOff]}>{d}</Text>
                  </RippleButton>
                </View>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // 7칸(44씩)을 줄 가운데에 두어 좌우 여백을 같게 한다(360 화면에서 양쪽 8).
  // 시안은 왼쪽에만 16을 두어 오른쪽 끝에 붙어 있었다
  cal: { gap: space[4], paddingHorizontal: space[8] },
  head: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 44, height: 44, borderRadius: radius[22], alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  icon20: { width: 20, height: 20 },

  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  weekName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 15.6,
    paddingVertical: space[4],
    color: color.muted,
    textAlign: 'center',
  },

  grid: { gap: space[2] },
  day: { width: 44, height: 44, borderRadius: radius[22], alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: color.accent },
  dayText: { fontFamily: font.medium, fontSize: 17, color: color.fg, fontVariant: ['tabular-nums'] },
  dayTextOn: { fontFamily: font.bold },
  dayTextOff: { color: color.disabled },
})
