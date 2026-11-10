import { Image } from 'expo-image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ClockBand } from '@/components/ClockBand'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Fade } from '@/components/Fade'
import { RippleButton } from '@/components/RippleButton'
import { Switch } from '@/components/Switch'
import { TAB_BAR_SPACE } from '@/components/TabBar'
import { TabTop } from '@/components/TabTop'
import { getFlow } from '@/features/app/flow'
import { useBedInfo } from '@/features/bed/bed'
import { onBoardAlarms } from '@/features/bed/boardLink'
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
  dropsOnly,
  fixDraft,
  inLabel,
  nextAlarm,
  sampleAlarms,
  WAY_FULL_NAMES,
  whenLabel,
} from './alarm'
import { AlarmOff } from './AlarmOff'
import { AlarmSheet } from './AlarmSheet'
import { PullScroll } from '@/components/PullScroll'

// 피그마 "알람 탭 / 목록". 맨 위 요약 카드, 알람 줄들, "알람 추가" 버튼.
// "알람 추가"를 누르면 새 알람 창이, 알람 줄을 누르면 그 알람을 고치는 창이 열린다
// 피그마 "알람 탭 / 버튼 없는 침대 안내"·"알람 탭 / 병원에서 알람을 막음": 침대에 알람을 끄는 버튼이 없거나
// 병원에서 알람을 막았으면 머리 아래를 안내로 채우고 알람을 쓸 수 없게 한다(둘 다면 버튼 안내를 보인다)
export function AlarmTab() {
  const insets = useSafeAreaInsets()
  // 침대를 초기화한 뒤에는 빈 목록에서 시작한다
  const [alarms, setAlarms] = useState<Alarm[]>(() => (getFlow().wipe ? [] : sampleAlarms()))
  // 보드에 연결되면 보드가 알려 주는 목록을 쓴다
  useEffect(() => onBoardAlarms(setAlarms), [])
  const [sheetOpen, setSheetOpen] = useState(false)
  // 고칠 알람. 닫는 동안 제목이 바뀌지 않게 닫을 때는 두고, 열 때 정한다
  const [editing, setEditing] = useState<Alarm | null>(null)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  // 같은 날 같은 시각에 울리는 다른 켜진 알람이 있으면 저장 전에 확인 창으로 덮어쓸지 묻는다
  const [clash, setClash] = useState<{
    message: string
    ok: () => void
  } | null>(null)
  const closeClash = useCallback(() => setClash(null), [])

  // 알림 확인 창(울리는 중·저장 중·연결 문제)
  const [note, setNote] = useState<{ title: string; message: string } | null>(null)
  const closeNote = useCallback(() => setNote(null), [])
  const bedNow = useBedInfo()
  const offline = !bedNow.connected || bedNow.loading
  const ringing = (id: number | undefined) => id != null && bedNow.ringingId === id

  // 목록에서 켜고 끄기도 침대에 보내고, 답이 오면 바꾼다. 답을 기다리는 동안 그 줄의 스위치는 흐리게 두고 바꾸지 않는다.
  // 기다리는 동안 그 알람(덮어쓰는 알람 포함)은 "저장 중인 알람"이라 다른 저장이 건드리지 못하게 막는다.
  // 창의 저장도 답을 기다리는 동안 SHEET 자리에 바뀌는 알람들을 적어 둔다
  const [waitOn, setWaitOn] = useState<Record<number, number[]>>({})
  const busyOf = (w: Record<number, number[]>) => (id: number) => Object.values(w).some((ids) => ids.includes(id))
  const isBusy = busyOf(waitOn)
  const toggleReqs = useRef(new Map<number, BedRequest>())
  useEffect(() => {
    const reqs = toggleReqs.current
    return () => reqs.forEach((r) => r.cancel())
  }, [])
  const setWaiting = (key: number, ids: number[] | null) =>
    setWaitOn((w) => {
      const next = { ...w }
      if (ids) next[key] = ids
      else delete next[key]
      return next
    })

  // 확인 창을 누른 순간의 최신 상태(확인 창이 떠 있는 사이에 울리기 시작하거나 다른 저장이 시작될 수 있다)
  const latest = useRef({
    alarms,
    waitOn,
    ringingId: bedNow.ringingId as number | null | undefined,
  })
  useEffect(() => {
    latest.current = { alarms, waitOn, ringingId: bedNow.ringingId }
  }, [alarms, waitOn, bedNow.ringingId])

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
  const send = (message: Parameters<typeof startBedRequest>[0], apply: () => void, ids: number[]) => {
    // 연결이 끊겼거나 침대 상태를 읽는 중에는 옛 값으로 저장하지 않는다(창의 버튼도 막혀 있다)
    if (offline) return
    request.current = startBedRequest(message, {
      onAck: () => {
        request.current = null
        setWait(null)
        setWaiting(SHEET, null)
        apply()
        setSheetOpen(false)
      },
      onTimeout: () => setWait('failed'),
    })
    setWaiting(SHEET, ids)
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
    setWaiting(SHEET, null)
    setSheetOpen(false)
  }

  // 덮어쓰면 바뀌는 알람 중 울리는 중이거나 저장을 기다리는 것이 있으면 전체를 막는다
  const overwriteBlocked = (clashes: Clash[], ringingId: number | null | undefined, busy: (id: number) => boolean) => {
    const ring = clashes.find((c) => c.alarm.id === ringingId)
    if (ring) {
      setNote({
        title: '지금 울리고 있는 알람과 겹쳐요',
        message: `${alarmName(ring.alarm)} 알람이 끝난 뒤에 다시 저장해 주세요.`,
      })
      return true
    }
    const busyOne = clashes.find((c) => busy(c.alarm.id))
    if (busyOne) {
      setNote({
        title: '저장 중인 알람과 겹쳐요',
        message: `${alarmName(busyOne.alarm)} 알람의 저장이 끝난 뒤에 다시 시도해 주세요.`,
      })
      return true
    }
    return false
  }

  // 겹치는 알람이 있으면 덮어쓸지 묻는다. 덮어쓰기를 누른 순간 최신 상태로 대상과 겹치는 알람을 다시 계산한다
  const withClashes = (d: AlarmDraft, selfId: number | undefined, run: (clashes: Clash[]) => void) => {
    const clashes = findClashes(d, alarms, selfId, isBusy)
    if (overwriteBlocked(clashes, bedNow.ringingId, isBusy)) return
    if (!clashes.length) return run([])
    setClash({
      message: clashLabel(clashes[0]),
      ok: () => {
        const L = latest.current
        if (selfId != null && L.ringingId === selfId) {
          setNote({
            title: '지금 울리는 중인 알람이에요',
            message: '알람이 끝난 뒤에 바꿀 수 있어요.',
          })
          return
        }
        const busy = busyOf(L.waitOn)
        const now = findClashes(d, L.alarms, selfId, busy)
        if (overwriteBlocked(now, L.ringingId, busy)) return
        run(now)
      },
    })
  }

  // 저장(시안 commit). 이번만: 그 회차 하나만 바꾼 시각·끄는 방법을 날짜별 예외로 넣고, 반복의 시각·끄는 방법은 그대로 둔다.
  // 앞으로 계속 시각을 바꾸면 날짜별 예외를 모두 없애고, 끄는 방법만 바꾸면 이번만은 없애고 덮어써 안 울리는 날은 남긴다
  const save = (draft: AlarmDraft, scope?: AlarmScope, onceOff?: number) => {
    const target = editing
    if (ringing(target?.id)) return
    let d: AlarmDraft = { ...draft, exc: { ...(draft.exc ?? {}) } }
    if (!d.days.length) d.exc = {}
    if (scope === 'once' && target) {
      if (onceOff == null) return
      d.exc = { ...d.exc, [onceOff]: { time: draft.time, way: draft.way } }
      d.time = target.time
      d.way = target.way
    } else if (target && d.time !== target.time) d.exc = {}
    else if (target && d.way !== target.way) d.exc = dropsOnly(d.exc)
    d = fixDraft(d)
    withClashes(d, target?.id, (clashes) => {
      send(
        {
          type: 'alarm-save',
          body: {
            id: target?.id ?? null,
            draft: d,
            scope,
            onceOff,
            overwrite: clashes.map((c) => c.alarm.id),
          },
        },
        () =>
          setAlarms((list) => {
            const rest = clashes.length ? applyOverwrite(list, d, clashes) : list
            return target
              ? rest.map((a) => (a.id === target.id ? { ...a, ...d, on: true } : a))
              : [
                  ...rest,
                  {
                    ...d,
                    id: Math.max(0, ...rest.map((a) => a.id)) + 1,
                    on: true,
                  },
                ]
          }),
        [...(target ? [target.id] : []), ...clashes.map((c) => c.alarm.id)],
      )
    })
  }
  const remove = () => {
    const target = editing
    if (!target || ringing(target.id)) return
    send({ type: 'alarm-delete', body: { id: target.id } }, () => setAlarms((list) => list.filter((a) => a.id !== target.id)), [target.id])
  }

  // 켤 때는 지난 한 번 알람의 날짜도 다음에 울릴 날로 맞추고, 새로 저장할 때처럼 겹치는 알람이 있으면 덮어쓸지 묻는다
  const toggle = (id: number, on: boolean) => {
    const a = alarms.find((x) => x.id === id)
    if (!a || offline || ringing(id) || id in waitOn) return
    if (isBusy(id))
      return setNote({
        title: '저장 중인 알람이에요',
        message: '저장이 끝난 뒤에 다시 시도해 주세요.',
      })
    const turned = { ...a, ...fixDraft(a), on }
    const go = (clashes: Clash[]) => {
      const done = () => {
        toggleReqs.current.delete(id)
        setWaiting(id, null)
      }
      const r = startBedRequest(
        {
          type: 'alarm-save',
          body: { id, on, overwrite: clashes.map((c) => c.alarm.id) },
        },
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
            setNote({
              title: '연결이 원활하지 않아요',
              message: '바뀐 내용이 침대에 저장되지 않았을 수 있어요. 다시 시도해 주세요.',
            })
          },
        },
      )
      toggleReqs.current.set(id, r)
      setWaiting(id, [id, ...clashes.map((c) => c.alarm.id)])
    }
    if (on) withClashes(turned, id, go)
    else go([])
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
      <PullScroll
        contentContainerStyle={[
          styles.body,
          alarmOff && styles.bodyFill,
          {
            paddingTop: insets.top + space[6],
            paddingBottom: TAB_BAR_SPACE + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTop />
        {/* 불러오는 중에는 위 줄을 뺀 내용이 0.2초 동안 흐려지고 막힌다(시안 .loading) */}
        <Fade on={bedNow.loading} style={[styles.inner, alarmOff && styles.bodyFill]}>
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
                  locked={!bedNow.connected}
                  onPress={() => openSheet(a)}
                  onToggle={(on) => toggle(a.id, on)}
                />
              ))}
            </View>
            {/* 연결이 끊기면 알람 추가·알람 줄·스위치를 흐리게 막는다(시안 .off-line) */}
            <View style={[styles.addShadow, !bedNow.connected && styles.lockDim]} pointerEvents={bedNow.connected ? 'auto' : 'none'}>
              <RippleButton style={styles.add} onPress={() => openSheet(null)}>
                <Image source={require('../../../assets/icons/plus.svg')} style={styles.icon20} />
                <Text style={styles.addText}>알람 추가</Text>
              </RippleButton>
            </View>
          </>
        )}
        </Fade>
      </PullScroll>
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

// 창의 저장이 답을 기다리는 동안 바뀌는 알람을 적어 두는 자리(알람 번호와 겹치지 않는 값)
const SHEET = -1

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
  // 이번만 바꾼 회차면 그 회차의 시각·끄는 방법으로
  const { alarm, off, mins, tm, way } = next
  const { ampm, hm } = clockParts(tm)
  return (
    <View style={styles.card} accessible accessibilityLabel={`다음 알람 ${whenLabel(off)} ${clockLabel(tm)}`}>
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
        {WAY_FULL_NAMES[way]}
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
  // 꺼진 알람과 잠시 끈 알람은 글이 흐리다(시안 .arow.off, .arow.paused)
  const dim = (!alarm.on || alarm.pauseTo != null) && styles.off
  return (
    <View style={styles.rowShadow}>
      <RippleButton style={styles.row} onPress={onPress} disabled={locked} accessibilityLabel={`${clockLabel(alarm.time)} 알람 고치기`}>
        <View style={[styles.main, locked && styles.lockDim]}>
          <View style={[styles.at, dim]}>
            <Text style={styles.atAmpm}>{ampm}</Text>
            <Text style={styles.atTime}>{hm}</Text>
          </View>
          <Text style={[styles.meta, dim]}>{alarmMetaLabel(alarm)}</Text>
        </View>
        {/* 답을 기다리는 동안 스위치만 흐리게(시안 .sw.wait) */}
        <View style={locked ? styles.lockDim : waiting && styles.off}>
          <Switch
            value={alarm.on}
            onValueChange={onToggle}
            disabled={waiting || locked}
            accessibilityLabel={`${clockLabel(alarm.time)} 알람 켜기`}
          />
        </View>
      </RippleButton>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingHorizontal: 18, gap: space[8] },
  inner: { gap: space[8] },
  // 연결 끊김으로 막힌 칸(시안 .off-line ... opacity: .45)
  lockDim: { opacity: 0.45 },
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
  eyebrow: {
    fontFamily: font.medium,
    fontSize: 15,
    color: color['on-ink-muted'],
  },
  big: { height: 48.3, flexDirection: 'row', alignItems: 'flex-start' },
  bigAmpm: {
    marginTop: 23,
    marginRight: 6,
    fontFamily: font.medium,
    fontSize: 20,
    lineHeight: 21,
    color: color['on-ink'],
  },
  bigTime: {
    marginTop: -0.65,
    fontFamily: font.extraLight,
    fontSize: 46,
    lineHeight: 48.3,
    letterSpacing: -1.38,
    color: color['on-ink'],
  },
  sub: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 20.4,
    color: color['on-ink-muted'],
  },
  // 켜진 알람이 없을 때
  none: {
    marginTop: space[2],
    fontFamily: font.bold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: color['on-ink'],
  },
  noneSub: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22.5,
    color: color['on-ink-muted'],
  },

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
  main: {
    flex: 1,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    gap: space[2],
  },
  at: { height: 30.8, flexDirection: 'row', alignItems: 'flex-start' },
  atAmpm: {
    marginTop: 11,
    marginRight: 6,
    fontFamily: font.semiBold,
    fontSize: 15,
    lineHeight: 16.5,
    color: color.fg,
  },
  atTime: {
    marginTop: -0.4,
    fontFamily: font.light,
    fontSize: 28,
    lineHeight: 30.8,
    letterSpacing: -0.56,
    color: color.fg,
  },
  meta: {
    fontFamily: font.medium,
    fontSize: 15,
    lineHeight: 18.75,
    color: color.muted,
  },
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
