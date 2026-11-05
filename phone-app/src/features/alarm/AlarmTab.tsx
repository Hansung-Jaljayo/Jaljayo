import { Image } from 'expo-image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ClockBand } from '@/components/ClockBand'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RippleButton } from '@/components/RippleButton'
import { Switch } from '@/components/Switch'
import { TAB_BAR_SPACE, TabBar, type TabKey } from '@/components/TabBar'
import { TabTop } from '@/components/TabTop'
import { getFlow } from '@/features/app/flow'
import { useBedInfo } from '@/features/bed/bed'
import { type BedRequest, startBedRequest } from '@/features/bed/requests'
import { color, font, radius, shadow, space } from '@/theme/tokens'

import {
  type Alarm,
  type AlarmDraft,
  type AlarmScope,
  type Clash,
  alarmMetaLabel,
  applyOverwrite,
  clashLabel,
  clockLabel,
  clockParts,
  findClashes,
  fixDraft,
  inLabel,
  nextAlarm,
  sampleAlarms,
  WAY_FULL_NAMES,
  whenLabel,
} from './alarm'
import { AlarmOff } from './AlarmOff'
import { AlarmSheet } from './AlarmSheet'

// 피그마 "알람 탭 / 목록". 맨 위 요약 카드, 알람 줄들, "알람 추가" 버튼.
// "알람 추가"를 누르면 새 알람 창이, 알람 줄을 누르면 그 알람을 고치는 창이 열린다
// 피그마 "알람 탭 / 버튼 없는 침대 안내"·"알람 탭 / 병원에서 알람을 막음": 침대에 알람을 끄는 버튼이 없거나
// 병원에서 알람을 막았으면 머리 아래를 안내로 채우고 알람을 쓸 수 없게 한다(둘 다면 버튼 안내를 보인다)
export function AlarmTab({ onTab }: { onTab?: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets()
  // 침대를 초기화한 뒤에는 빈 목록에서 시작한다
  const [alarms, setAlarms] = useState<Alarm[]>(() => (getFlow().wipe ? [] : sampleAlarms()))
  const [sheetOpen, setSheetOpen] = useState(false)
  // 고칠 알람. 닫는 동안 제목이 바뀌지 않게 닫을 때는 두고, 열 때 정한다
  const [editing, setEditing] = useState<Alarm | null>(null)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  // 같은 날 같은 시각에 울리는 다른 켜진 알람이 있으면 저장 전에 확인 창으로 덮어쓸지 묻는다
  const [clash, setClash] = useState<{ message: string; ok: () => void } | null>(null)
  const closeClash = useCallback(() => setClash(null), [])

  // 알림 확인 창(울리는 중·저장 중·연결 문제)
  const [note, setNote] = useState<{ title: string; message: string } | null>(null)
  const closeNote = useCallback(() => setNote(null), [])
  const bedNow = useBedInfo()
  const offline = !bedNow.connected || bedNow.loading
  const ringing = (id: number | undefined) => id != null && bedNow.ringingId === id

  // 목록에서 켜고 끄기도 침대에 보내고, 답이 오면 바꾼다. 답을 기다리는 동안 그 줄의 스위치는 흐리게 두고 바꾸지 않는다.
  // 기다리는 동안 그 알람(덮어쓰는 알람 포함)은 "저장 중인 알람"이라 다른 저장이 건드리지 못하게 막는다
  const [waitOn, setWaitOn] = useState<Record<number, number[]>>({})
  const busyIds = Object.values(waitOn).flat()
  const isBusy = (id: number) => busyIds.includes(id)
  const toggleReqs = useRef(new Map<number, BedRequest>())
  useEffect(() => {
    const reqs = toggleReqs.current
    return () => reqs.forEach((r) => r.cancel())
  }, [])

  const openSheet = (alarm: Alarm | null) => {
    if (alarm && isBusy(alarm.id)) {
      return setNote({
        title: '저장 중인 알람이에요',
        message: '다른 알람을 저장하면서 이 알람도 바뀌는 중이에요. 저장이 끝난 뒤에 다시 열어 주세요.',
      })
    }
    setEditing(alarm)
    setSheetOpen(true)
  }

  // 창에서 저장·삭제를 누르면 침대에 보내고 답을 기다린다. 답이 오면 목록에 반영하고 창을 닫는다.
  // 5초 넘게 답이 없으면 창이 "다시 시도·취소"를 보여 준다
  const [wait, setWait] = useState<'saving' | 'failed' | null>(null)
  const request = useRef<BedRequest | null>(null)
  useEffect(() => () => request.current?.cancel(), [])
  const send = (message: Parameters<typeof startBedRequest>[0], apply: () => void) => {
    // 연결이 끊겼거나 침대 상태를 읽는 중에는 옛 값으로 저장하지 않는다(창의 버튼도 막혀 있다)
    if (offline) return
    request.current = startBedRequest(message, {
      onAck: () => {
        request.current = null
        setWait(null)
        apply()
        setSheetOpen(false)
      },
      onTimeout: () => setWait('failed'),
    })
    setWait('saving')
  }
  const retry = () => {
    if (offline) return
    request.current?.retry()
    setWait('saving')
  }
  const cancelWait = () => {
    request.current?.cancel()
    request.current = null
    setWait(null)
    setSheetOpen(false)
  }


  // 덮어쓰면 바뀌는 알람 중 울리는 중이거나 저장을 기다리는 것이 있으면 전체를 막는다
  const overwriteBlocked = (clashes: Clash[]) => {
    const ring = clashes.find((c) => ringing(c.alarm.id))
    if (ring) {
      setNote({ title: '지금 울리고 있는 알람과 겹쳐요', message: `${alarmName(ring.alarm)} 알람이 끝난 뒤에 다시 저장해 주세요.` })
      return true
    }
    const busy = clashes.find((c) => isBusy(c.alarm.id))
    if (busy) {
      setNote({ title: '저장 중인 알람과 겹쳐요', message: `${alarmName(busy.alarm)} 알람의 저장이 끝난 뒤에 다시 시도해 주세요.` })
      return true
    }
    return false
  }

  const save = (draft: AlarmDraft, scope?: AlarmScope, onceOff?: number) => {
    const target = editing
    if (ringing(target?.id)) return
    // 이번만은 그 날짜 회차 하나만 새 시각으로 울리므로 그 회차만 견준다
    const rings = scope === 'once' && onceOff != null ? { ...draft, days: [], dateOff: onceOff } : draft
    const clashes = findClashes(rings, alarms, target?.id)
    if (overwriteBlocked(clashes)) return
    const go = () => {
      if (overwriteBlocked(clashes)) return
      send({ type: 'alarm-save', body: { id: target?.id ?? null, draft, scope, onceOff, overwrite: clashes.map((c) => c.alarm.id) } }, () =>
        setAlarms((list) => {
          const rest = clashes.length ? applyOverwrite(list, rings, clashes) : list
          // 이번만은 그 날짜 회차 하나만 바꾸는데, 날짜별로 바꾼 회차를 담는 칸이 아직 없어 그 알람은 그대로 둔다
          if (scope === 'once') return rest
          return target
            ? rest.map((a) => (a.id === target.id ? { ...a, ...draft, on: true } : a))
            : [...rest, { ...draft, id: Math.max(0, ...rest.map((a) => a.id)) + 1, on: true }]
        }),
      )
    }
    if (clashes.length) setClash({ message: clashLabel(clashes[0]), ok: go })
    else go()
  }
  const remove = () => {
    const target = editing
    if (!target || ringing(target.id)) return
    send({ type: 'alarm-delete', body: { id: target.id } }, () =>
      setAlarms((list) => list.filter((a) => a.id !== target.id)),
    )
  }

  // 켤 때는 지난 한 번 알람의 날짜도 다음에 울릴 날로 맞추고, 새로 저장할 때처럼 겹치는 알람이 있으면 덮어쓸지 묻는다
  const toggle = (id: number, on: boolean) => {
    const a = alarms.find((x) => x.id === id)
    if (!a || offline || ringing(id) || id in waitOn) return
    if (isBusy(id)) return setNote({ title: '저장 중인 알람이에요', message: '저장이 끝난 뒤에 다시 시도해 주세요.' })
    const turned = { ...a, ...fixDraft(a), on }
    const clashes = on ? findClashes(turned, alarms, id) : []
    if (overwriteBlocked(clashes)) return
    const go = () => {
      if (overwriteBlocked(clashes)) return
      const done = () => {
        toggleReqs.current.delete(id)
        setWaitOn((w) => {
          const next = { ...w }
          delete next[id]
          return next
        })
      }
      const r = startBedRequest(
        { type: 'alarm-save', body: { id, on, overwrite: clashes.map((c) => c.alarm.id) } },
        {
          onAck: () => {
            done()
            setAlarms((list) => {
              const rest = clashes.length ? applyOverwrite(list, turned, clashes) : list
              return rest.map((x) => (x.id === id ? turned : x))
            })
          },
          onTimeout: () => {
            toggleReqs.current.get(id)?.cancel()
            done()
            setNote({ title: '연결이 원활하지 않아요', message: '바뀐 내용이 침대에 저장되지 않았을 수 있어요. 다시 시도해 주세요.' })
          },
        },
      )
      toggleReqs.current.set(id, r)
      setWaitOn((w) => ({ ...w, [id]: [id, ...clashes.map((c) => c.alarm.id)] }))
    }
    if (clashes.length) setClash({ message: clashLabel(clashes[0]), ok: go })
    else go()
  }

  const sorted = [...alarms].sort((x, y) => x.time - y.time)

  // 알람을 쓸 수 없게 되면 열려 있던 알람 창과 확인 창을 닫고, 기다리던 저장은 그만둔다
  const bed = useBedInfo()
  const noButton = !bed.hasButton
  const blocked = !!bed.ward && !bed.ward.alarmAllowed
  const alarmOff = noButton || blocked
  const [wasOff, setWasOff] = useState(alarmOff)
  if (alarmOff !== wasOff) {
    setWasOff(alarmOff)
    if (alarmOff) {
      setSheetOpen(false)
      setWait(null)
      setClash(null)
    }
  }
  useEffect(() => {
    if (!alarmOff) return
    request.current?.cancel()
    request.current = null
  }, [alarmOff])

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          alarmOff && styles.bodyFill,
          { paddingTop: insets.top + space[6], paddingBottom: TAB_BAR_SPACE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTop />
        {/* aoff · 꺼짐 안내 */}
        {noButton ? (
          <AlarmOff
            title="알람을 쓸 수 없는 침대예요"
            lines={['이 침대에는 알람을 끄는 버튼이 없어요.', '버튼이 있는 침대에서만 알람을 쓸 수 있어요.']}
          />
        ) : blocked ? (
          // 줄 나눔은 피그마 그대로
          <AlarmOff
            title={'병원에서 알람을 쓰지\n않도록 정했어요'}
            lines={['병실에서는 알람 소리가 옆 환자에게도 들려요.', '예약은 소리 없이 자세만 바꾸니', '그대로 쓸 수 있어요.']}
          />
        ) : (
          <>
            {/* tban · 시계 무효 띠(침대가 시각을 모를 때만) */}
            <ClockBand />
            <NextCard alarms={alarms} />
            <View style={styles.group}>
              {sorted.map((a) => (
                <AlarmRow
                  key={a.id}
                  alarm={a}
                  waiting={a.id in waitOn}
                  locked={offline}
                  onPress={() => openSheet(a)}
                  onToggle={(on) => toggle(a.id, on)}
                />
              ))}
            </View>
            <View style={styles.addShadow}>
              <RippleButton style={styles.add} onPress={() => openSheet(null)}>
                <Image source={require('../../../assets/icons/plus.svg')} style={styles.icon20} />
                <Text style={styles.addText}>알람 추가</Text>
              </RippleButton>
            </View>
          </>
        )}
      </ScrollView>
      <TabBar current="alarm" onPick={onTab} dimmed={alarmOff ? ['alarm'] : []} />
      <AlarmSheet
        open={sheetOpen}
        alarm={editing}
        onClose={closeSheet}
        onSave={save}
        onDelete={remove}
        wait={wait}
        onRetry={retry}
        onCancelWait={cancelWait}
        ringing={ringing(editing?.id)}
        onPast={(off, time) =>
          setNote({
            title: '이미 지난 시각이에요',
            message: `${whenLabel(off)} ${clockLabel(time)}는 이미 지났어요. 다른 시각을 고르거나 '앞으로 계속'으로 바꿔 주세요.`,
          })
        }
        offline={offline}
      />
      {/* dlg · 겹치는 알람 확인 창: 덮어쓰기를 누르면 저장을 이어 가고, 취소는 확인 창만 닫는다 */}
      <ConfirmDialog
        open={clash != null}
        title="겹치는 알람이 있어요"
        message={clash?.message ?? ''}
        okLabel="덮어쓰기"
        noLabel="취소"
        onOk={() => {
          const ok = clash?.ok
          setClash(null)
          ok?.()
        }}
        onClose={closeClash}
      />
      <ConfirmDialog open={note != null} title={note?.title ?? ''} message={note?.message ?? ''} onOk={closeNote} onClose={closeNote} />
    </View>
  )
}

// 확인 창에서 알람을 가리키는 말: "평일 오전 7시", "11월 6일 오전 7시"
const alarmName = (a: Alarm) => `${alarmMetaLabel(a).split(' · ')[0]} ${clockLabel(a.time)}`

// tcard · 요약 카드: 실제로 다음에 울릴 알람. 켜진 알람이 없으면 안내
function NextCard({ alarms }: { alarms: Alarm[] }) {
  const next = nextAlarm(alarms)
  if (!next) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>다음 알람</Text>
        <Text style={styles.none}>켜진 알람이 없어요</Text>
        <Text style={styles.noneSub}>알람을 켜거나 새로 추가해 주세요</Text>
      </View>
    )
  }
  const { alarm, off, mins } = next
  const { ampm, hm } = clockParts(alarm.time)
  return (
    <View style={styles.card} accessible accessibilityLabel={`다음 알람 ${whenLabel(off)} ${clockLabel(alarm.time)}`}>
      {/* 하루 안이면 남은 시간도 */}
      <Text style={styles.eyebrow}>
        다음 알람 · {whenLabel(off)}
        {mins < 1440 ? ` · ${inLabel(mins)}` : ''}
      </Text>
      <View style={styles.big}>
        <Text style={styles.bigAmpm}>{ampm}</Text>
        <Text style={styles.bigTime}>{hm}</Text>
      </View>
      <Text style={styles.sub}>
        {WAY_FULL_NAMES[alarm.way]}
        {alarm.lift ? ' · 머리 올림' : ''}
      </Text>
    </View>
  )
}

// arow · 알람 줄: 시각과 반복 요일(또는 날짜), 오른쪽 켜기 스위치. 꺼진 알람은 글이 흐리다. 누르면 고치기
function AlarmRow({
  alarm,
  waiting,
  locked,
  onPress,
  onToggle,
}: {
  alarm: Alarm
  waiting: boolean
  locked: boolean
  onPress: () => void
  onToggle: (on: boolean) => void
}) {
  const { ampm, hm } = clockParts(alarm.time)
  const dim = !alarm.on && styles.off
  return (
    <View style={[styles.rowShadow, waiting && styles.off]}>
      <RippleButton style={styles.row} onPress={onPress} accessibilityLabel={`${clockLabel(alarm.time)} 알람 고치기`}>
        <View style={styles.main}>
          <View style={[styles.at, dim]}>
            <Text style={styles.atAmpm}>{ampm}</Text>
            <Text style={styles.atTime}>{hm}</Text>
          </View>
          <Text style={[styles.meta, dim]}>{alarmMetaLabel(alarm)}</Text>
        </View>
        <Switch
          value={alarm.on}
          onValueChange={onToggle}
          disabled={waiting || locked}
          accessibilityLabel={`${clockLabel(alarm.time)} 알람 켜기`}
        />
      </RippleButton>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingHorizontal: 18, gap: space[8] },
  // 안내가 머리 아래 남은 자리를 채운다
  bodyFill: { flexGrow: 1 },

  card: {
    paddingHorizontal: 20,
    paddingVertical: space[16],
    gap: space[2],
    borderRadius: radius[34],
    backgroundColor: color.ink,
    boxShadow: shadow.sheetTop,
  },
  eyebrow: { fontFamily: font.medium, fontSize: 15, color: color['on-ink-muted'] },
  big: { height: 48.3, flexDirection: 'row', alignItems: 'flex-start' },
  bigAmpm: { marginTop: 23, marginRight: 6, fontFamily: font.medium, fontSize: 20, lineHeight: 21, color: color['on-ink'] },
  bigTime: {
    marginTop: -0.65,
    fontFamily: font.extraLight,
    fontSize: 46,
    lineHeight: 48.3,
    letterSpacing: -1.38,
    color: color['on-ink'],
  },
  sub: { fontFamily: font.regular, fontSize: 17, lineHeight: 20.4, color: color['on-ink-muted'] },
  // 켜진 알람이 없을 때
  none: {
    marginTop: space[2],
    fontFamily: font.bold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: color['on-ink'],
  },
  noneSub: { fontFamily: font.regular, fontSize: 15, lineHeight: 22.5, color: color['on-ink-muted'] },

  group: { gap: space[8] },
  // 그림자가 잘리지 않게 바깥 칸에 그림자, 안쪽 버튼에 물결
  rowShadow: { borderRadius: radius[24], boxShadow: shadow.card },
  row: {
    padding: space[4],
    paddingRight: space[16],
    borderRadius: radius[24],
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  main: { flex: 1, paddingHorizontal: space[12], paddingVertical: space[8], gap: space[2] },
  at: { height: 30.8, flexDirection: 'row', alignItems: 'flex-start' },
  atAmpm: { marginTop: 11, marginRight: 6, fontFamily: font.semiBold, fontSize: 15, lineHeight: 16.5, color: color.fg },
  atTime: {
    marginTop: -0.4,
    fontFamily: font.light,
    fontSize: 28,
    lineHeight: 30.8,
    letterSpacing: -0.56,
    color: color.fg,
  },
  meta: { fontFamily: font.medium, fontSize: 15, lineHeight: 18.75, color: color.muted },
  off: { opacity: 0.5 },

  // 그림자가 잘리지 않게 바깥 칸에 그림자, 안쪽 버튼에 물결
  addShadow: { borderRadius: radius[20], boxShadow: shadow.card },
  add: {
    height: 56,
    paddingHorizontal: space[6],
    borderRadius: radius[20],
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
  },
  icon20: { width: 20, height: 20 },
  addText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
})
