import { Image } from 'expo-image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RippleButton } from '@/components/RippleButton'
import { TAB_BAR_SPACE, TabBar, type TabKey } from '@/components/TabBar'
import { TabTop } from '@/components/TabTop'
import { clockLabel, clockParts, inLabel, nowMinutes } from '@/features/alarm/alarm'
import { type BedMessage, type BedRequest, startBedRequest } from '@/features/bed/requests'
import { color, font, radius, shadow, space } from '@/theme/tokens'

import { type Resv, type ResvDraft, resvFromDraft, resvMinsLeft, resvSubLabel, sampleResv, shiftResv } from './resv'
import { ResvSheet } from './ResvSheet'

// 예약 탭. 피그마 "예약 탭 / 있음"과 "예약 탭 / 없음 + 실패 카드"는 이 탭의 두 모습이다.
// 맨 위 요약 카드: 예약이 있으면 시각·남은 시간·바꿀 자세, 없으면 "자세 예약하기".
// 예약이 있으면 그 아래 10분 앞당기기·늦추기·예약 취소, 맨 아래 지난 예약을 실행하지 못한 이유 카드
export function ResvTab({ onTab }: { onTab?: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets()
  const [{ item, fail }, setResv] = useState(() => sampleResv())
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
  const request = useRef<BedRequest | null>(null)
  useEffect(() => () => request.current?.cancel(), [])
  const send = (message: BedMessage, apply: () => void) => {
    if (request.current) return
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
    send({ type: 'resv-save', body: next }, () => setResv((r) => ({ ...r, item: next })))
  }
  const cancel = () => send({ type: 'resv-cancel', body: null }, () => setResv((r) => ({ ...r, item: null })))

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
          setResv((r) => ({ ...r, item: next }))
          setSheetOpen(false)
        },
        onTimeout: () => setSheetWait('failed'),
      },
    )
    setSheetWait('saving')
  }
  const retrySheet = () => {
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
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + space[6], paddingBottom: TAB_BAR_SPACE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTop />

        {/* tcard · 요약 카드 */}
        {item ? (
          <ResvCard item={item} now={now} waiting={waiting} onEdit={() => setSheetOpen(true)} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>자세 예약</Text>
            <Text style={styles.none}>예약이 없어요</Text>
            <Text style={styles.noneSub}>정한 시각에 침대가 소리 없이 자세를 바꿔요</Text>
            {/* act · 버튼: 자세 예약 창을 연다 */}
            <RippleButton style={styles.act} onPress={() => setSheetOpen(true)}>
              <Image source={require('../../../assets/icons/plus.svg')} style={styles.icon20} />
              <Text style={styles.actText}>자세 예약하기</Text>
            </RippleButton>
          </View>
        )}

        {/* 예약 버튼 묶음. 예약이 없으면 비어 있어도 카드 사이를 8 더 띄운다 */}
        <View style={[styles.acts, waiting && styles.waiting]} pointerEvents={waiting ? 'none' : 'auto'}>
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

        {/* mcard · 알림 카드: 실행하지 못한 예약 */}
        {fail && (
          <View style={styles.mcard}>
            <Text style={styles.mTitle}>{fail.title}</Text>
            <Text style={styles.mReason}>{fail.reason}</Text>
          </View>
        )}
      </ScrollView>
      <TabBar current="resv" onPick={onTab} />
      <ResvSheet
        open={sheetOpen}
        item={item}
        onClose={closeSheet}
        onSave={saveSheet}
        wait={sheetWait}
        onRetry={retrySheet}
        onCancelWait={cancelSheetWait}
      />
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
function ResvCard({ item, now, waiting, onEdit }: { item: Resv; now: number; waiting: boolean; onEdit: () => void }) {
  const { ampm, hm } = clockParts(item.time)
  return (
    <View style={[styles.card, styles.cardOn, waiting && styles.waiting]} pointerEvents={waiting ? 'none' : 'auto'}>
      <Text style={styles.eyebrow}>
        {item.off ? '내일' : '오늘'} · {inLabel(Math.max(0, resvMinsLeft(item, now)))}
      </Text>
      <RippleButton
        style={styles.big}
        rippleColor={color['on-ink']}
        onPress={onEdit}
        accessibilityLabel={`예약 바꾸기, ${clockLabel(item.time)}`}
      >
        <Text style={styles.bigAmpm}>{ampm}</Text>
        <Text style={styles.bigTime}>{hm}</Text>
        <Image source={require('../../../assets/icons/chevron-on-ink.svg')} style={styles.chevron} />
      </RippleButton>
      <Text style={styles.sub}>{resvSubLabel(item)}</Text>
    </View>
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
  waiting: { opacity: 0.55 },

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
})
