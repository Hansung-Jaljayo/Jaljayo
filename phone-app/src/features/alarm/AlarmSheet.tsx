import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { RippleButton } from '@/components/RippleButton'
import { Switch } from '@/components/Switch'
import { TimeWheels } from '@/components/TimeWheels'
import { color, font, radius, space } from '@/theme/tokens'

import {
  type AlarmDraft,
  DAY_NAMES,
  DAY_ORDER,
  clockLabel,
  dateLabel,
  fixDraft,
  newAlarmDraft,
  nextRings,
  pauseLabel,
  VOLUME_NAMES,
  WAY_NAMES,
  whenLabel,
} from './alarm'

type Props = {
  open: boolean
  onClose: () => void
  // 저장은 흉내 내지 않는다. 침대에 보내고 침대가 저장했다고 답할 때 화면이 "저장되었어요"로 바뀐다
  onSave?: (draft: AlarmDraft) => void
}

// 알람 탭의 "알람 추가"로 여는 키 큰 시트. 피그마 "알람 창 / 한 번 알람"과 "알람 창 / 반복 알람"은 이 창의 두 모습이다.
// 요일을 고르지 않으면 한 번 울리는 알람, 고르면 반복 알람이다
export function AlarmSheet({ open, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AlarmDraft>(newAlarmDraft)
  // 열 때마다 새 알람으로 시작한다
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(newAlarmDraft())
  }

  const update = (patch: Partial<AlarmDraft>) => setDraft((d) => fixDraft({ ...d, ...patch }))
  const repeat = draft.days.length > 0
  // 건너뛰기가 켜져 있으면 고른 그 날, 꺼져 있으면 켰을 때 건너뛸 다음 회차
  const skipOff = draft.skipOff ?? nextRings(draft)[0]

  const toggleDay = (day: number) =>
    update({ days: draft.days.includes(day) ? draft.days.filter((x) => x !== day) : [...draft.days, day] })

  return (
    <BottomSheet open={open} onClose={onClose} tall>
      {/* shead · 시트 머리 */}
      <View style={styles.head}>
        <Text style={styles.title} role="heading">
          알람 추가
        </Text>
        <RippleButton style={styles.close} onPress={onClose} accessibilityLabel="닫기">
          <Image source={require('../../../assets/icons/x.svg')} style={styles.icon22} />
        </RippleButton>
      </View>

      <TimeWheels value={draft.time} onChange={(time) => update({ time })} />

      {/* apart · 반복 요일과 알람 설정 */}
      <View style={styles.apart}>
        <Text style={styles.label}>반복</Text>
        <View style={styles.days} role="group" accessibilityLabel="반복할 요일">
          {DAY_ORDER.map((day) => {
            const on = draft.days.includes(day)
            return (
              <RippleButton
                key={day}
                style={[styles.day, on && styles.dayOn]}
                rippleColor={color.fg}
                accessibilityState={{ selected: on }}
                onPress={() => toggleDay(day)}
              >
                <Text style={styles.dayText}>{DAY_NAMES[day]}</Text>
              </RippleButton>
            )
          })}
        </View>

        <View>
          {/* 날짜는 한 번 알람에만 */}
          {!repeat && <RowButton name="날짜" value={dateLabel(draft.dateOff)} />}
          <RowButton name="끄는 방법" value={WAY_NAMES[draft.way]} />
          <RowButton name="소리 크기" value={VOLUME_NAMES[draft.volume]} />
          <View style={[styles.row, styles.switchRow]}>
            <View>
              <Text style={styles.rowName}>알람 때 머리 올리기</Text>
              <Text style={styles.rowSub}>머리를 30도까지 올려요</Text>
            </View>
            <Switch
              value={draft.lift}
              onValueChange={(lift) => update({ lift })}
              accessibilityLabel="알람 때 머리 올리기"
            />
          </View>
          {/* 건너뛰기·잠시 끄기는 반복 알람에만 */}
          {repeat && (
            <View style={[styles.row, styles.switchRow]}>
              <View>
                <Text style={styles.rowName}>다음 한 번 건너뛰기</Text>
                {skipOff != null && (
                  <Text style={styles.rowSub}>
                    {whenLabel(skipOff)} {clockLabel(draft.time)}만 울리지 않아요
                  </Text>
                )}
              </View>
              <Switch
                value={draft.skipOff != null}
                // 켜는 순간 보이는 다음 회차의 날짜를 저장한다. 그 뒤로는 그 날짜만 건너뛴다
                onValueChange={(on) => update({ skipOff: on ? (nextRings(draft)[0] ?? null) : null })}
                accessibilityLabel="다음 한 번 건너뛰기"
              />
            </View>
          )}
          {repeat && <RowButton name="잠시 끄기" value={pauseLabel(draft.pauseTo)} />}
        </View>
      </View>

      {/* action · 시트 버튼 */}
      <RippleButton style={styles.action} rippleColor={color['on-ink']} onPress={() => onSave?.(draft)}>
        <Image source={require('../../../assets/icons/check.svg')} style={[styles.icon22, styles.checkIcon]} />
        <Text style={styles.actionText}>저장</Text>
      </RippleButton>
    </BottomSheet>
  )
}

// lrow · 목록 줄: 누르면 아래로 선택지가 펼쳐지는 줄(펼친 모습은 "… 펼침" 화면에서 만든다)
function RowButton({ name, value, onPress }: { name: string; value: string; onPress?: () => void }) {
  return (
    <RippleButton style={[styles.row, styles.rowButton]} onPress={onPress} accessibilityLabel={`${name} ${value}`}>
      <Text style={[styles.rowName, styles.rowKey]}>{name}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      <Image source={require('../../../assets/icons/chevron.svg')} style={styles.icon20} />
    </RippleButton>
  )
}

const styles = StyleSheet.create({
  head: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.48, color: color.fg },
  close: {
    width: 48,
    height: 48,
    borderRadius: radius[24],
    backgroundColor: color.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon22: { width: 22, height: 22 },
  icon20: { width: 20, height: 20 },

  apart: { gap: space[8] },
  label: { fontFamily: font.bold, fontSize: 15, color: color['fg-2'] },
  days: { flexDirection: 'row', gap: space[5] },
  day: {
    flex: 1,
    height: 44,
    borderRadius: 21,
    backgroundColor: color.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: color.accent },
  dayText: { fontFamily: font.bold, fontSize: 17, color: color.fg },

  // 줄 사이 선은 아래쪽 1, 다음 줄과 겹쳐 한 줄로 보인다
  row: {
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    marginBottom: -1,
    paddingHorizontal: space[16],
  },
  rowButton: { height: 57, flexDirection: 'row', alignItems: 'center', gap: space[8] },
  rowKey: { flex: 1 },
  rowName: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  rowValue: { fontFamily: font.medium, fontSize: 17, color: color.muted },
  rowSub: { fontFamily: font.medium, fontSize: 15, color: color.muted },
  switchRow: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[12] },

  action: {
    height: 60,
    borderRadius: radius[20],
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // 체크 그림 칸 양옆 빈 여백(약 3.6)을 잘라, 눈에 보이는 체크+글자가 가운데 오게
  checkIcon: { marginHorizontal: -3.6 },
  actionText: { fontFamily: font.bold, fontSize: 17, color: color['on-ink'] },
})
