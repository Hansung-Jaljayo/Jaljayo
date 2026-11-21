import { Image } from 'expo-image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ClockBand } from '@/components/ClockBand'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Fade } from '@/components/Fade'
import { RippleButton } from '@/components/RippleButton'
import { TAB_BAR_SPACE } from '@/components/TabBar'
import { TabTop } from '@/components/TabTop'
import { clockLabel, clockParts, inLabel, nowMinutes } from '@/features/alarm/alarm'
import { useBedInfo } from '@/features/bed/bed'
import { type BedMessage, type BedRequest, startBedRequest } from '@/features/bed/requests'
import { color, cssEase, font, radius, shadow, space } from '@/theme/tokens'

import {
  type Resv,
  type ResvDraft,
  resvFromDraft,
  resvMinsLeft,
  resvSubLabel,
  setResvState,
  shiftResv,
  useResvState,
} from './resv'
import { ResvSheet } from './ResvSheet'
import { PullScroll } from '@/components/PullScroll'

// 예약 탭. 피그마 "예약 탭 / 있음"과 "예약 탭 / 없음 + 실패 카드"는 이 탭의 두 모습이다.
// 맨 위 요약 카드: 예약이 있으면 시각·남은 시간·바꿀 자세, 없으면 "자세 예약하기".
// 예약이 있으면 그 아래 10분 앞당기기·늦추기·예약 취소, 맨 아래 지난 예약을 실행하지 못한 이유 카드
export function ResvTab() {
  const insets = useSafeAreaInsets()
  const { item, fail } = useResvState()
  // 남은 시간이 바뀌도록 30초마다 다시 그린다
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])

  // 앞당기기·늦추기·취소는 침대에 보내고, 침대가 답하면 반영한다. 기다리는 동안 카드와 버튼을 흐리게 하고 막는다.
  // 5초 넘게 답이 없으면 기다리기를 그만두고 확인 창으로 알린다
  const [waiting, setWaiting] = useState(false)
  const [noReply, setNoReply] = useState(false)
  // 연결이 끊겼거나 침대 상태를 읽는 중에는 옛 값으로 저장하지 않는다
  const bed = useBedInfo()
  const offline = !bed.connected || bed.loading
  const [offNote, setOffNote] = useState(false)
  const closeOffNote = useCallback(() => setOffNote(false), [])
  const request = useRef<BedRequest | null>(null)
  useEffect(() => () => request.current?.cancel(), [])
  const send = (message: BedMessage, apply: () => void) => {
    if (request.current) return
    if (offline) return setOffNote(true)
    request.current = startBedRequest(message, {
      onAck: () => {
        request.current = null
        setWaiting(false)
        apply()
      },
      onTimeout: () => {
        request.current?.cancel()
        request.current = null
        setWaiting(false)
        setNoReply(true)
      },
    })
    setWaiting(true)
  }
  const closeNoReply = useCallback(() => setNoReply(false), [])

  const shift = (by: number) => {
    if (!item) return
    const next = shiftResv(item, by, nowMinutes())
    if (!next) return
    send({ type: 'resv-save', body: next }, () => setResvState({ item: next }))
  }
  const cancel = () => send({ type: 'resv-cancel', body: null }, () => setResvState({ item: null }))

  // 자세 예약 창: "자세 예약하기"나 요약 카드의 시각으로 연다. 저장하면 침대에 보내고 창에서 답을 기다린다
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const [sheetWait, setSheetWait] = useState<'saving' | 'failed' | null>(null)
  const sheetRequest = useRef<BedRequest | null>(null)
  useEffect(() => () => sheetRequest.current?.cancel(), [])
  // 지금부터 24시간 안이 아닌 시각을 고르면 확인 창으로 알린다(날짜를 몰래 바꾸지 않는다)
  const [badTime, setBadTime] = useState(false)
  const closeBadTime = useCallback(() => setBadTime(false), [])
  const saveSheet = (draft: ResvDraft) => {
    if (offline) return setOffNote(true)
    const next = resvFromDraft(draft, item, nowMinutes())
    if (!next) {
      setBadTime(true)
      return
    }
    sheetRequest.current = startBedRequest(
      { type: 'resv-save', body: next },
      {
        onAck: () => {
          sheetRequest.current = null
          setSheetWait(null)
          setResvState({ item: next })
          setSheetOpen(false)
        },
        onTimeout: () => setSheetWait('failed'),
      },
    )
    setSheetWait('saving')
  }
  const retrySheet = () => {
    if (offline) return setOffNote(true)
    sheetRequest.current?.retry()
    setSheetWait('saving')
  }
  const cancelSheetWait = () => {
    sheetRequest.current?.cancel()
    sheetRequest.current = null
    setSheetWait(null)
    setSheetOpen(false)
  }

  return (
    <View style={styles.screen}>
      <PullScroll
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + space[6], paddingBottom: TAB_BAR_SPACE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTop />
        {/* 불러오는 중에는 위 줄을 뺀 내용이 0.2초 동안 흐려지고 막힌다(시안 .loading) */}
        <Fade on={bed.loading} style={styles.inner}>
        {/* tban · 시계 무효 띠(침대가 시각을 모를 때만) */}
        <ClockBand />

        {/* tcard · 요약 카드 */}
        {item ? (
          <ResvCard item={item} now={now} waiting={waiting} locked={!bed.connected} onEdit={() => setSheetOpen(true)} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>자세 예약</Text>
            <Text style={styles.none}>예약이 없어요</Text>
            <Text style={styles.noneSub}>정한 시각에 침대가 소리 없이 자세를 바꿔요</Text>
            {/* act · 버튼: 자세 예약 창을 연다 */}
            {/* 연결이 끊기면 예약 버튼들을 흐리게 막는다(시안 .off-line [data-rnew] 등) */}
            <View style={!bed.connected && styles.lockDim} pointerEvents={bed.connected ? 'auto' : 'none'}>
            <RippleButton style={styles.act} onPress={() => setSheetOpen(true)}>
              <Image source={require('../../../assets/icons/plus.svg')} style={styles.icon20} />
              <Text style={styles.actText}>자세 예약하기</Text>
            </RippleButton>
            </View>
          </View>
        )}

        {/* 예약 버튼 묶음. 예약이 없으면 비어 있어도 카드 사이를 8 더 띄운다 */}
        <Fade on={waiting} to={0.55}>
        <View style={[styles.acts, !bed.connected && styles.lockDim]} pointerEvents={bed.connected ? 'auto' : 'none'}>
          {item && (
            <>
              {/* twin · 두 버튼 */}
              <View style={styles.twin}>
                <View style={styles.btnShadow}>
                  <RippleButton style={styles.btn} onPress={() => shift(-10)}>
                    <Text style={styles.btnText}>10분 앞당기기</Text>
                  </RippleButton>
                </View>
                <View style={styles.btnShadow}>
                  <RippleButton style={styles.btn} onPress={() => shift(10)}>
                    <Text style={styles.btnText}>10분 늦추기</Text>
                  </RippleButton>
                </View>
              </View>
              <RippleButton style={styles.ghost} rippleColor={color.red} onPress={cancel}>
                <Text style={styles.ghostText}>예약 취소</Text>
              </RippleButton>
            </>
          )}
        </View>
        </Fade>

        {/* mcard · 알림 카드: 실행하지 못한 예약 */}
        {/* 꾹 누르면 가운데에 삭제 버튼이 뜬다. 카드를 다시 누르면 닫힌다 */}
        {fail && <FailCard title={fail.title} reason={fail.reason} />}
        </Fade>
      </PullScroll>
      <ResvSheet
        open={sheetOpen}
        item={item}
        onClose={closeSheet}
        onSave={saveSheet}
        wait={sheetWait}
        onRetry={retrySheet}
        onCancelWait={cancelSheetWait}
      />
      <ConfirmDialog open={offNote} title="지금은 저장할 수 없어요" message={'침대와 연결되어 정보를 확인한 뒤 저장할 수 있어요.'} onOk={closeOffNote} onClose={closeOffNote} />
      <ConfirmDialog
        open={badTime}
        title="예약할 수 없는 시각이에요"
        message="자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요."
        onOk={closeBadTime}
        onClose={closeBadTime}
      />
      <ConfirmDialog
        open={noReply}
        title="연결이 원활하지 않아요"
        message="바뀐 내용이 침대에 저장되지 않았을 수 있어요. 다시 시도해 주세요."
        onOk={closeNoReply}
        onClose={closeNoReply}
      />
    </View>
  )
}

// 예약이 있을 때 요약 카드: "오늘 · 28분 뒤" / 오후 11:10 > / "잠 자세로 바꿔요 · 머리 0° 다리 0°".
// 시각을 누르면 자세 예약 창으로 예약을 바꾼다
function ResvCard({ item, now, waiting, locked, onEdit }: { item: Resv; now: number; waiting: boolean; locked: boolean; onEdit: () => void }) {
  const { ampm, hm } = clockParts(item.time)
  return (
    <Fade on={waiting} to={0.55} style={[styles.card, styles.cardOn]}>
      <Text style={styles.eyebrow}>
        {item.off ? '내일' : '오늘'} · {inLabel(Math.max(0, resvMinsLeft(item, now)))}
      </Text>
      <RippleButton
        style={[styles.big, locked && styles.lockDim]}
        disabled={locked}
        rippleColor={color['on-ink']}
        onPress={onEdit}
        accessibilityLabel={`예약 바꾸기, ${clockLabel(item.time)}`}
      >
        <Text style={styles.bigAmpm}>{ampm}</Text>
        <Text style={styles.bigTime}>{hm}</Text>
        <Image source={require('../../../assets/icons/chevron-on-ink.svg')} style={styles.chevron} />
      </RippleButton>
      <Text style={styles.sub}>{resvSubLabel(item)}</Text>
    </Fade>
  )
}

const EASE = Easing.bezier(...cssEase)

// 실행하지 못한 예약 기록 카드. 꾹 누르면 글자가 흐려지며 가운데에 삭제 버튼이 커지며 나타나고(0.2초),
// 삭제를 누르면 카드가 흐려지며 사라진 뒤 기록을 지운다(침대에 알리는 요청은 아직 없다)
function FailCard({ title, reason }: { title: string; reason: string }) {
  const [menu, setMenu] = useState(false)
  const [k] = useState(() => new Animated.Value(0))
  const [gone] = useState(() => new Animated.Value(1))
  useEffect(() => {
    Animated.timing(k, { toValue: menu ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true }).start()
  }, [menu, k])
  // 삭제 버튼의 물결이 보인 뒤에 사라지기 시작한다(바로 흐려지면 누른 물결이 안 보인다)
  const remove = () => {
    Animated.timing(gone, { toValue: 0, duration: 200, delay: 260, easing: EASE, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setResvState({ fail: null })
    })
  }
  return (
    <Animated.View style={{ opacity: gone, transform: [{ scale: gone.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
      <RippleButton
        style={styles.mcard}
        rippleColor={color.fg}
        onLongPress={() => setMenu(true)}
        onPress={() => setMenu(false)}
        delayLongPress={400}
        accessibilityHint="꾹 누르면 기록을 지울 수 있어요"
      >
        <Animated.View style={{ opacity: k.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }}>
          <Text style={styles.mTitle}>{title}</Text>
          <Text style={styles.mReason}>{reason}</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.mDelWrap,
            { opacity: k, transform: [{ scale: k.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
          ]}
          pointerEvents={menu ? 'box-none' : 'none'}
        >
          <RippleButton style={styles.mDel} rippleColor={color['on-ink']} onPress={remove}>
            <Text style={styles.mDelText}>삭제</Text>
          </RippleButton>
        </Animated.View>
      </RippleButton>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingHorizontal: 18, gap: space[8] },

  card: {
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 20,
    borderRadius: radius[34],
    backgroundColor: color.ink,
    boxShadow: shadow.sheetTop,
  },
  // 예약이 있을 때: 줄 사이 4
  cardOn: { gap: space[4] },
  eyebrow: { fontFamily: font.medium, fontSize: 15, color: color['on-ink-muted'] },

  // 예약이 없을 때
  none: {
    marginTop: space[6],
    fontFamily: font.bold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: color['on-ink'],
  },
  noneSub: { marginTop: space[4], fontFamily: font.regular, fontSize: 15, lineHeight: 22.5, color: color['on-ink-muted'] },
  act: {
    marginTop: space[16],
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
  actText: { fontFamily: font.bold, fontSize: 17, color: color.fg },

  // 예약이 있을 때: 큰 시각(오전·오후는 작게), 오른쪽 화살표
  big: { alignSelf: 'flex-start', height: 58.8, flexDirection: 'row', alignItems: 'flex-start', gap: space[8] },
  bigAmpm: { marginTop: 27, fontFamily: font.medium, fontSize: 24, lineHeight: 25.2, color: color['on-ink'] },
  bigTime: {
    marginTop: -0.9,
    fontFamily: font.extraLight,
    fontSize: 56,
    lineHeight: 58.8,
    letterSpacing: -1.68,
    // 시안처럼 숫자 폭을 같게 한다(시각이 바뀌어도 화살표가 덜 움직인다)
    fontVariant: ['tabular-nums'],
    color: color['on-ink'],
  },
  chevron: { width: 22, height: 22, marginTop: 18.39 },
  sub: { fontFamily: font.regular, fontSize: 17, color: color['on-ink-muted'] },

  // 침대의 답을 기다리는 동안
  inner: { gap: space[8] },
  // 연결 끊김으로 막힌 칸(시안 .off-line ... opacity: .45)
  lockDim: { opacity: 0.45 },

  acts: { gap: space[6] },
  twin: { flexDirection: 'row', gap: space[8] },
  // 그림자가 잘리지 않게 바깥 칸에 그림자, 안쪽 버튼에 물결
  btnShadow: { flex: 1, borderRadius: radius[20], boxShadow: shadow.card },
  btn: {
    height: 56,
    paddingHorizontal: space[6],
    borderRadius: radius[20],
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  ghost: { height: 48, paddingHorizontal: space[6], borderRadius: radius[20], alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: font.bold, fontSize: 17, color: color.red, textDecorationLine: 'underline' },

  mcard: {
    paddingHorizontal: 18,
    paddingVertical: space[16],
    gap: space[4],
    borderRadius: radius[22],
    backgroundColor: color.card,
    boxShadow: shadow.card,
  },
  mTitle: { fontFamily: font.bold, fontSize: 17, lineHeight: 21.25, color: color.fg },
  mReason: { fontFamily: font.regular, fontSize: 15, lineHeight: 22.5, color: color.muted },
  mDelWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  mDel: { height: 44, paddingHorizontal: 28, borderRadius: 14, backgroundColor: color.red, alignItems: 'center', justifyContent: 'center' },
  mDelText: { fontFamily: font.bold, fontSize: 17, color: color['on-ink'] },
})
