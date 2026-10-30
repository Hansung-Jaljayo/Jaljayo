import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ExpandRow } from '@/components/ExpandRow'
import { OptionRows } from '@/components/OptionRows'
import { RippleButton } from '@/components/RippleButton'
import { Switch } from '@/components/Switch'
import { TimeWheels } from '@/components/TimeWheels'
import { color, font, radius, space } from '@/theme/tokens'

import {
  type Alarm,
  type AlarmDraft,
  type AlarmScope,
  DAY_NAMES,
  DAY_ORDER,
  clockLabel,
  dateLabel,
  fixDraft,
  monthDayLabel,
  needsScope,
  newAlarmDraft,
  nextRings,
  nowMinutes,
  onceBase,
  onceTarget,
  PAUSE_OPTIONS,
  pauseEnd,
  pauseLabel,
  scopeLabel,
  VOLUME_NAMES,
  VOLUME_OPTIONS,
  WAY_NAMES,
  WAY_OPTIONS,
  whenLabel,
} from './alarm'
import { DateCalendar } from './DateCalendar'

// 펼칠 수 있는 줄. 한 번에 하나만 펼친다
type RowKey = 'date' | 'way' | 'volume' | 'pause'

type Props = {
  open: boolean
  // 고칠 알람. 없으면 새 알람을 추가한다
  alarm?: Alarm | null
  onClose: () => void
  // 저장은 흉내 내지 않는다. 침대에 보내고 침대가 저장했다고 답할 때 화면이 "저장되었어요"로 바뀐다
  // 반복 알람의 시각·끄는 방법을 고치면 scope가 온다. 이번만이면 onceOff(오늘부터 며칠 뒤) 회차 하나만
  // draft의 시각·끄는 방법으로 바꾸고, 반복의 시각·끄는 방법은 원래 알람 그대로 둔다
  onSave?: (draft: AlarmDraft, scope?: AlarmScope, onceOff?: number) => void
  // 고치는 알람 지우기. 저장처럼 침대가 지웠다고 답한 뒤에 목록에서 빠진다
  onDelete?: () => void
}

// 알람 탭의 "알람 추가"나 알람 줄로 여는 키 큰 시트. 알람 줄로 열면 그 알람을 고치는 "알람 고치기"가 된다.
// 피그마 "알람 창 / 한 번 알람"과 "알람 창 / 반복 알람"은 이 창의 두 모습이다.
// 요일을 고르지 않으면 한 번 울리는 알람, 고르면 반복 알람이다.
// 피그마 "알람 창 / 울리지 못한 이유": 지난 회차를 울리지 못한 알람을 고칠 때는 머리 아래에 그 이유를 보여 준다
export function AlarmSheet({ open, alarm, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<AlarmDraft>(newAlarmDraft)
  const [openRow, setOpenRow] = useState<RowKey | null>(null)
  // 이 창에서 잠시 끄기를 새로 골랐는지. 고른 뒤 시각·요일을 바꾸면 끄는 기간을 다시 센다
  const [pauseNew, setPauseNew] = useState(false)
  // 저장을 눌러 이번만·앞으로 계속을 묻는 중인지
  const [asking, setAsking] = useState(false)
  // 열 때마다 새 알람(고칠 때는 그 알람)으로, 줄은 모두 접은 채 시작한다
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(alarm ? fixDraft(alarm) : newAlarmDraft())
      setOpenRow(null)
      setPauseNew(false)
      setAsking(false)
    }
  }

  // 묻는 중에 값을 바꾸면 묻기를 닫고 저장 버튼으로 되돌린다(묻는 글의 날짜가 바뀐 값과 어긋나지 않게)
  const update = (patch: Partial<AlarmDraft>, recount = pauseNew) => {
    setAsking(false)
    setDraft((d) => {
      const next = fixDraft({ ...d, ...patch })
      return recount && next.pauseDays ? { ...next, pauseTo: pauseEnd(next, next.pauseDays) } : next
    })
  }
  const repeat = draft.days.length > 0
  // 건너뛰기가 켜져 있으면 고른 그 날, 꺼져 있으면 켰을 때 건너뛸 다음 회차
  const skipOff = draft.skipOff ?? nextRings(draft)[0]

  const save = () => {
    if (needsScope(alarm, draft)) setAsking(true)
    else onSave?.(draft)
  }

  const saveScope = (scope: AlarmScope) => {
    if (!alarm) return
    if (scope === 'all') {
      onSave?.(draft, 'all')
      return
    }
    const off = onceTarget(alarm, draft, pauseNew)
    if (off == null) return
    // 바꿀 회차의 날에 고른 시각이 이미 지났으면 저장하지 않는다. 시안은 "이미 지난 시각이에요" 확인 창을 띄운다(확인 창은 아직 없음)
    if (off * 1440 + draft.time <= nowMinutes()) return
    onSave?.({ ...draft, pauseTo: onceBase(alarm, draft, pauseNew).pauseTo }, 'once', off)
  }

  const toggleRow = (key: RowKey) => setOpenRow(openRow === key ? null : key)

  const toggleDay = (day: number) =>
    update({ days: draft.days.includes(day) ? draft.days.filter((x) => x !== day) : [...draft.days, day] })

  return (
    <BottomSheet open={open} onClose={onClose} tall>
      {/* shead · 시트 머리 */}
      <View style={styles.head}>
        <Text style={styles.title} role="heading">
          {alarm ? '알람 고치기' : '알람 추가'}
        </Text>
        <RippleButton style={styles.close} onPress={onClose} accessibilityLabel="닫기">
          <Image source={require('../../../assets/icons/x.svg')} style={styles.icon22} />
        </RippleButton>
      </View>

      {/* hint · 울리지 못한 이유 */}
      {alarm?.missed ? <Text style={styles.hint}>{alarm.missed}</Text> : null}

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
          {!repeat && (
            <ExpandRow
              name="날짜"
              value={dateLabel(draft.dateOff)}
              open={openRow === 'date'}
              onPress={() => toggleRow('date')}
            >
              {/* 날짜를 고르면 줄을 접는다 */}
              <DateCalendar
                value={draft.dateOff}
                time={draft.time}
                onPick={(dateOff) => {
                  update({ dateOff })
                  setOpenRow(null)
                }}
              />
            </ExpandRow>
          )}
          <ExpandRow
            name="끄는 방법"
            value={WAY_NAMES[draft.way]}
            open={openRow === 'way'}
            onPress={() => toggleRow('way')}
          >
            {/* 고르면 줄을 접는다 */}
            <OptionRows
              label="끄는 방법"
              options={WAY_OPTIONS}
              value={draft.way}
              onPick={(way) => {
                update({ way })
                setOpenRow(null)
              }}
            />
          </ExpandRow>
          <ExpandRow
            name="소리 크기"
            value={VOLUME_NAMES[draft.volume]}
            open={openRow === 'volume'}
            onPress={() => toggleRow('volume')}
          >
            {/* 고르면 줄을 접는다 */}
            <OptionRows
              label="소리 크기"
              options={VOLUME_OPTIONS}
              value={draft.volume}
              onPick={(volume) => {
                update({ volume })
                setOpenRow(null)
              }}
            />
          </ExpandRow>
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
          {repeat && (
            <ExpandRow
              name="잠시 끄기"
              value={pauseLabel(draft.pauseTo)}
              open={openRow === 'pause'}
              onPress={() => toggleRow('pause')}
            >
              {/* 고를 때마다 끝나는 날을 보여 준다. 고르면 줄을 접는다 */}
              <OptionRows
                label="잠시 끄기"
                options={PAUSE_OPTIONS.map((o) => ({
                  ...o,
                  sub: o.value ? `${monthDayLabel(pauseEnd(draft, o.value))}까지 울리지 않아요` : undefined,
                }))}
                value={draft.pauseTo != null ? (draft.pauseDays ?? 0) : 0}
                onPick={(days) => {
                  setPauseNew(days > 0)
                  update({ pauseDays: days || null, pauseTo: null }, days > 0)
                  setOpenRow(null)
                }}
              />
            </ExpandRow>
          )}
        </View>
      </View>

      {/* scope · 반복 알람을 이번만 바꿀지 앞으로 계속 바꿀지. 묻는 동안 저장 버튼은 숨긴다 */}
      {asking && alarm && (
        <View style={styles.scope}>
          <Text style={styles.scopeText}>{scopeLabel(alarm, draft, pauseNew)}</Text>
          {/* twin2 · 두 버튼 */}
          <View style={styles.twin2}>
            <RippleButton style={[styles.action, styles.half, styles.actionAlt]} rippleColor={color.fg} onPress={() => saveScope('once')}>
              <Text style={[styles.actionText, styles.actionAltText]}>이번만</Text>
            </RippleButton>
            <RippleButton style={[styles.action, styles.half]} rippleColor={color['on-ink']} onPress={() => saveScope('all')}>
              <Text style={styles.actionText}>앞으로 계속</Text>
            </RippleButton>
          </View>
        </View>
      )}

      {/* actions · 버튼 묶음 */}
      <View style={styles.actions}>
        {/* action · 시트 버튼 */}
        {!asking && (
          <RippleButton style={styles.action} rippleColor={color['on-ink']} onPress={save}>
            <Image source={require('../../../assets/icons/check.svg')} style={[styles.icon22, styles.checkIcon]} />
            <Text style={styles.actionText}>저장</Text>
          </RippleButton>
        )}
        {/* del · 지우기 버튼: 알람을 고칠 때만 */}
        {alarm && (
          <RippleButton style={styles.del} rippleColor={color.red} onPress={onDelete}>
            <Text style={styles.delText}>이 알람 삭제</Text>
          </RippleButton>
        )}
      </View>
    </BottomSheet>
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
  hint: { fontFamily: font.regular, fontSize: 15, color: color.muted },

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
  rowName: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  rowSub: { fontFamily: font.medium, fontSize: 15, color: color.muted },
  switchRow: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[12] },

  scope: { gap: space[8] },
  scopeText: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 22.5, color: color['fg-2'] },
  twin2: { flexDirection: 'row', gap: space[8] },
  half: { flex: 1 },
  actionAlt: { backgroundColor: color.accent },
  actionAltText: { color: color.fg },

  actions: { gap: space[8] },
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
  del: { height: 50, paddingHorizontal: space[6], alignItems: 'center', justifyContent: 'center' },
  delText: { fontFamily: font.bold, fontSize: 17, color: color.red, textDecorationLine: 'underline' },
})
