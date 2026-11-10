import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { RippleButton } from '@/components/RippleButton'
import { Spinner } from '@/components/Spinner'
import { TimeWheels } from '@/components/TimeWheels'
import { clockLabel } from '@/features/alarm/alarm'
import { color, font, radius, space } from '@/theme/tokens'

import { POSE_NAMES, POSE_ORDER, quickDraft, type Resv, type ResvDraft, resvDraft } from './resv'

// 빠른 버튼: 지금부터 n분 뒤
const QUICK = [
  { mins: 15, name: '15분 뒤' },
  { mins: 30, name: '30분 뒤' },
  { mins: 60, name: '1시간 뒤' },
]

type Props = {
  open: boolean
  // 바꿀 예약. 없으면 새로 예약한다
  item: Resv | null
  onClose: () => void
  // 저장은 흉내 내지 않는다. 침대에 보내고 침대가 답하면 예약 탭에 반영하고 창을 닫는다
  onSave: (draft: ResvDraft) => void
  // 침대의 답을 기다리는 중이면 'saving', 5초 넘게 답이 없으면 'failed'(알람 창과 같다)
  wait?: 'saving' | 'failed' | null
  onRetry?: () => void
  onCancelWait?: () => void
}

const noop = () => {}

// 피그마 "자세 예약 창": 바꿀 자세, 빠른 버튼(15분·30분·1시간 뒤), 시간 바퀴, "오후 11시 10분에 잠 자세로" 버튼.
// 예약 탭의 "자세 예약하기"나 요약 카드의 시각으로 연다
export function ResvSheet({ open, item, onClose, onSave, wait = null, onRetry, onCancelWait }: Props) {
  const [draft, setDraft] = useState<ResvDraft>(() => resvDraft(item))
  // 고른 빠른 버튼. 바퀴를 돌리면 풀린다
  const [quick, setQuick] = useState<number | null>(null)
  // 열 때마다 지금 예약(없으면 30분 뒤 잠 자세)으로 시작한다
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(resvDraft(item))
      setQuick(null)
    }
  }
  const locked = wait != null
  const saving = wait === 'saving'
  const failed = wait === 'failed'

  // 바퀴만 돌렸으면 예약이 있을 때는 원래 날짜, 없을 때는 저장할 때 오늘·내일을 정한다
  const turn = (time: number) => {
    setQuick(null)
    setDraft((d) => ({ ...d, time, off: item ? d.off : null }))
  }

  return (
    // 저장 중에는 바탕 누르기·끌어내리기·뒤로 가기로도 닫히지 않는다
    <BottomSheet open={open} onClose={locked ? noop : onClose} toEnd={failed}>
      {/* shead · 시트 머리 */}
      <View style={styles.head}>
        <Text style={styles.title} role="heading">
          자세 예약
        </Text>
        <RippleButton
          style={[styles.close, locked && styles.closeLocked]}
          onPress={onClose}
          disabled={locked}
          accessibilityLabel="닫기"
        >
          <Image source={require('../../../assets/icons/x.svg')} style={styles.icon22} />
        </RippleButton>
      </View>

      {/* 바꿀 자세 */}
      <View style={[styles.part, locked && styles.locked]} pointerEvents={locked ? 'none' : 'auto'}>
        <Text style={styles.label}>바꿀 자세</Text>
        <View style={styles.purpose} role="radiogroup" accessibilityLabel="바꿀 자세">
          {POSE_ORDER.map((key) => {
            const on = draft.purpose === key
            return (
              <RippleButton
                key={key}
                role="radio"
                style={[styles.chip, on && styles.chipOn]}
                rippleColor={on ? color['on-ink'] : color.fg}
                accessibilityState={{ checked: on }}
                onPress={() => setDraft((d) => ({ ...d, purpose: key }))}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{POSE_NAMES[key]}</Text>
              </RippleButton>
            )
          })}
        </View>
      </View>

      {/* quick · 빠른 버튼 */}
      <View style={[styles.quick, locked && styles.locked]} pointerEvents={locked ? 'none' : 'auto'}>
        {QUICK.map((q) => {
          const on = quick === q.mins
          return (
            <RippleButton
              key={q.mins}
              style={[styles.chip, on && styles.chipOn]}
              rippleColor={on ? color['on-ink'] : color.fg}
              accessibilityState={{ selected: on }}
              onPress={() => {
                setQuick(q.mins)
                setDraft((d) => quickDraft(d, q.mins))
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{q.name}</Text>
            </RippleButton>
          )
        })}
      </View>

      <View style={locked && styles.locked}>
        <TimeWheels value={draft.time} onChange={turn} disabled={locked} />
      </View>

      {/* savenote · 답이 없을 때 안내 */}
      {failed && <Text style={styles.saveNote}>연결이 원활하지 않아요. 다시 시도해 주세요</Text>}

      {/* actions · 버튼 묶음 */}
      <View style={styles.actions}>
        {/* action · 시트 버튼: "오후 11시 10분에 잠 자세로". 저장 중에는 돌아가는 표시와 "저장 중…", 답이 없으면 "다시 시도" */}
        <RippleButton
          style={styles.action}
          rippleColor={color['on-ink']}
          onPress={failed ? onRetry : () => onSave(draft)}
          disabled={saving}
          accessibilityState={{ busy: saving, disabled: saving }}
        >
          {saving && <Spinner color={color['on-ink']} />}
          {!locked && (
            <Image source={require('../../../assets/icons/check.svg')} style={[styles.icon22, styles.checkIcon]} />
          )}
          <Text style={styles.actionText}>
            {saving ? '저장 중…' : failed ? '다시 시도' : `${clockLabel(draft.time)}에 ${POSE_NAMES[draft.purpose]} 자세로`}
          </Text>
        </RippleButton>
        {/* 취소: 기다리기를 그만두고 창을 닫는다 */}
        {failed && (
          <RippleButton style={[styles.action, styles.actionGray]} rippleColor={color.fg} onPress={onCancelWait}>
            <Text style={[styles.actionText, styles.actionGrayText]}>취소</Text>
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
  closeLocked: { opacity: 0.35 },
  icon22: { width: 22, height: 22 },
  locked: { opacity: 0.5 },

  part: { gap: space[6] },
  label: { fontFamily: font.bold, fontSize: 15, color: color['fg-2'] },
  purpose: { flexDirection: 'row', gap: space[6] },
  quick: { flexDirection: 'row', gap: space[8] },
  chip: {
    flex: 1,
    height: 52,
    paddingHorizontal: space[6],
    borderRadius: radius[16],
    backgroundColor: color.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.ink },
  chipText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  chipTextOn: { color: color['on-ink'] },

  saveNote: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 22.5, color: color.red, textAlign: 'center' },
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
  // 체크 그림 칸 양옆 빈 여백(약 3.6)을 잘라, 눈에 보이는 체크+글자가 가운데 오게(알람 창과 같다)
  checkIcon: { marginHorizontal: -3.6 },
  actionText: { fontFamily: font.bold, fontSize: 17, color: color['on-ink'] },
  actionGray: { backgroundColor: color.inset },
  actionGrayText: { color: color.fg },
})
