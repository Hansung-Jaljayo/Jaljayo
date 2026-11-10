import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View, Easing } from 'react-native'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PortalHost, PortalScope } from '@/components/Portal'
import { TabBar, type TabKey } from '@/components/TabBar'
import { AlarmTab } from '@/features/alarm/AlarmTab'
import { closeSettings, getFlow, setFlow, useFlow } from '@/features/app/flow'
import { bedName, getBedInfo, setBedInfo, useBedInfo } from '@/features/bed/bed'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { CONTACT } from '@/features/hospital/hospital'
import { PoseTab } from '@/features/pose/PoseTab'
import { resetPoseStore } from '@/features/pose/poseStore'
import { obBack, RegisterFlow, regActions } from '@/features/reg/RegisterFlow'
import { setResvState } from '@/features/resv/resv'
import { ResvTab } from '@/features/resv/ResvTab'
import OpenSourceScreen from '@/screens/OpenSourceScreen'
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import TermsScreen from '@/screens/TermsScreen'
import { color, font, radius, cssEase } from '@/theme/tokens'

// 시안 CSS ease
const EASE = Easing.bezier(...cssEase)

// 침대 상태를 읽는 시간. 침대와 주고받는 길이 생기면 침대가 상태를 보내 줄 때 loading을 끈다
const LOAD_MS = 2000

const TAB_ORDER: TabKey[] = ['pose', 'alarm', 'resv']

// 첫 화면: 자세 탭. 시안처럼 세 탭을 옆으로 나란히 붙인 넘김 판에 그려 두고(탭을 바꿔도 각 탭의 상태가 남는다),
// 손가락으로 밀어 넘기거나 아래 탭을 누르면 옆 탭으로 간다. 아래 탭 막대는 하나만 두고 알약이 넘긴 정도를 따라간다.
// 탭 안의 시트·확인 창은 탭 막대 위층(PortalHost)에 그린다. 등록·오류·병원 관리 화면과 설정 화면은 그 위에 덮는다
export default function Index() {
  const [tab, setTab] = useState<TabKey>('pose')
  const flow = useFlow()
  const bed = useBedInfo()
  const reset = useBedRequest()
  const [resetFail, setResetFail] = useState(false)
  const [ringBlock, setRingBlock] = useState(false)
  const [toast, setToast] = useState('')
  const lastBack = useRef(0)
  const { width } = useWindowDimensions()
  const pager = useRef<ComponentRef<typeof ScrollView>>(null)
  const [scrollX] = useState(() => new Animated.Value(0))
  // 자세 탭이 움직이는 중이거나 저장을 기다리면 넘기지 못한다
  // 자세 탭이 움직이는 동안 탭 넘기기를 막는다. 잠금 값은 TabPager 안에만 두어, 잠그고 풀 때 세 탭·설정 화면을 다시 그리지 않는다
  const lockRef = useRef<((on: boolean) => void) | null>(null)
  const onLock = useCallback((on: boolean) => lockRef.current?.(on), [])
  // 탭으로 가기: 판을 그 탭까지 부드럽게 넘긴다
  const go = useCallback(
    (key: TabKey) => {
      setTab(key)
      pager.current?.scrollTo({ x: TAB_ORDER.indexOf(key) * width, animated: true })
    },
    [width],
  )

  // 앱을 열 때와 연결이 돌아왔을 때 침대 상태를 다시 읽는다. 읽기 전에는 옛 값으로 조작하지 않게 막는다
  useEffect(() => {
    if (!bed.connected || !bed.registered) return
    setBedInfo({ loading: true })
    const t = setTimeout(() => setBedInfo({ loading: false }), LOAD_MS)
    return () => clearTimeout(t)
  }, [bed.connected, bed.registered, flow.wipe])

  // 침대 초기화: 침대가 지웠다고 답하면 이 폰의 탭도 처음 상태로 되돌리고 새로 등록하는 화면으로
  const doReset = useCallback(() => {
    if (!getBedInfo().connected || getBedInfo().loading) return
    // 진행 중인 알람은 바꾸지 않는다(설계서 4장)
    if (getBedInfo().ringingId != null) return setRingBlock(true)
    reset.send(
      { type: 'bed-reset', body: null },
      () => {
        setResetFail(false)
        setResvState({ item: null, fail: null })
        resetPoseStore()
        setBedInfo({ registered: false })
        setFlow({ settings: false, doc: null, wipe: getFlow().wipe + 1 })
        setTab('pose')
        regActions.unregister()
      },
      () => setResetFail(true),
    )
  }, [reset])

  // 갤럭시 뒤로 버튼: 가장 위에 떠 있는 것 하나만 닫거나 한 단계 뒤로. 첫 화면에서는 한 번 더 누르면 앱을 닫는다
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const f = getFlow()
      if (f.doc) {
        setFlow({ doc: null })
        return true
      }
      if (f.settings) {
        closeSettings()
        return true
      }
      if (obBack.current()) return true
      if (!f.ob && tab !== 'pose') {
        go('pose')
        return true
      }
      const now = Date.now()
      if (now - lastBack.current < 2000) return false
      lastBack.current = now
      setToast('한 번 더 누르면 앱이 닫혀요')
      return true
    })
    return () => sub.remove()
  }, [tab, go])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1600)
    return () => clearTimeout(t)
  }, [toast])

  // 개발 도구가 고르라고 한 탭으로 바꾼다(새 요청일 때만)
  const [askSeen, setAskSeen] = useState(0)
  if (flow.tabAsk && flow.tabAsk.n !== askSeen) {
    setAskSeen(flow.tabAsk.n)
    setTab(flow.tabAsk.key)
  }
  const askN = flow.tabAsk?.n
  const askKey = flow.tabAsk?.key
  useEffect(() => {
    if (askKey) pager.current?.scrollTo({ x: TAB_ORDER.indexOf(askKey) * width, animated: true })
  }, [askN, askKey, width])

  // 판을 넘기는 동안 화면 가운데에 더 많이 걸친 탭을 고른 탭으로
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const i = Math.max(0, Math.min(2, Math.round(e.nativeEvent.contentOffset.x / width)))
      setTab((t) => (t === TAB_ORDER[i] ? t : TAB_ORDER[i]))
    },
  })
  const bedForTabs = useBedInfo()
  const alarmOff = !bedForTabs.hasButton || (!!bedForTabs.ward && !bedForTabs.ward.alarmAllowed)
  // 설정을 등록 화면에서 열면 침대 묶음 없이 앱·병원 관리만
  const noBed = !!flow.ob && flow.ob !== 'splash'
  return (
    <View style={styles.fill}>
      <View style={styles.fill} key={flow.wipe}>
        <PortalScope>
          <TabPager pagerRef={pager} lockRef={lockRef} onScroll={onScroll}>
            {TAB_ORDER.map((k) => (
              // 화면 밖 탭은 읽기 순서에서 뺀다
              <View
                key={k}
                style={{ width }}
                accessibilityElementsHidden={tab !== k}
                importantForAccessibility={tab === k ? 'auto' : 'no-hide-descendants'}
              >
                {k === 'pose' ? <PoseTab onLock={onLock} /> : k === 'alarm' ? <AlarmTab /> : <ResvTab />}
              </View>
            ))}
          </TabPager>
          <TabBar current={tab} position={Animated.divide(scrollX, width)} onPick={go} dimmed={alarmOff ? ['alarm'] : []} />
        </PortalScope>
        <PortalHost />
      </View>
      <RegisterFlow />
      <SettingsScreen
        visible={flow.settings}
        isRegistered={!noBed && bed.registered}
        isConnected={bed.connected}
        isLoading={bed.loading}
        isWard={!!bed.ward}
        contact={CONTACT}
        bedName={bed.ward ? bedName(bed) : '잘자요 침대'}
        bedStatus={!bed.connected ? '연결 끊김 · 다시 연결 중' : bed.loading ? '불러오는 중' : '연결됨 · 이 폰으로 조작 중'}
        firmwareVersion={bed.firmware}
        onClose={closeSettings}
        onRenameBed={() => {
          closeSettings()
          regActions.rename()
        }}
        onNightTime={() => {
          closeSettings()
          regActions.night()
        }}
        onUnregister={() => {
          closeSettings()
          regActions.unregister()
        }}
        onReregister={() => {
          closeSettings()
          regActions.reregister()
        }}
        onResetBed={doReset}
        onPrivacyPolicy={() => setFlow({ doc: 'privacy' })}
        onTerms={() => setFlow({ doc: 'terms' })}
        onOpenSource={() => setFlow({ doc: 'oss' })}
        onHospitalAdmin={() => {
          closeSettings()
          regActions.admin()
        }}
      />
      <PrivacyPolicyScreen visible={flow.doc === 'privacy'} onClose={() => setFlow({ doc: null })} />
      <TermsScreen visible={flow.doc === 'terms'} onClose={() => setFlow({ doc: null })} />
      <OpenSourceScreen visible={flow.doc === 'oss'} onClose={() => setFlow({ doc: null })} />
      <ConfirmDialog
        open={resetFail}
        title="초기화했는지 확인하지 못했어요"
        message="침대 전원과 와이파이를 확인하고 다시 시도해 주세요."
        okLabel="다시 시도"
        noLabel="취소"
        onOk={() => {
          setResetFail(false)
          reset.retry()
        }}
        onClose={() => {
          setResetFail(false)
          reset.cancel()
        }}
      />
      <ConfirmDialog
        open={ringBlock}
        title="알람이 울리는 중이에요"
        message="알람이 끝난 뒤에 침대를 초기화할 수 있어요."
        onOk={() => setRingBlock(false)}
        onClose={() => setRingBlock(false)}
      />
      <Toast text={toast} />
    </View>
  )
}

// 알림 한 줄: 0.2초 동안 나타나고 사라진다(시안 .toast)
function Toast({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const [op] = useState(() => new Animated.Value(0))
  if (text && text !== shown) setShown(text)
  useEffect(() => {
    Animated.timing(op, { toValue: text ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true }).start()
  }, [text, op])
  if (!shown) return null
  return (
    <Animated.View style={[styles.toast, { opacity: op }]} pointerEvents="none" role="status">
      <Text style={styles.toastText}>{shown}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // 시안 .toast
  toast: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius[20],
    backgroundColor: 'rgba(29, 22, 20, 0.86)',
  },
  toastText: { fontFamily: font.semiBold, fontSize: 14, color: color['on-ink'] },
})

// 탭 넘김 판. 잠금 값을 여기서만 바꾸므로, 안에 든 탭들은 부모가 다시 그리지 않는 한 다시 그려지지 않는다
function TabPager({
  pagerRef,
  lockRef,
  onScroll,
  children,
}: {
  pagerRef: React.RefObject<ComponentRef<typeof ScrollView> | null>
  lockRef: React.RefObject<((on: boolean) => void) | null>
  onScroll: (...args: unknown[]) => void
  children: React.ReactNode
}) {
  const [lock, setLock] = useState(false)
  useEffect(() => {
    lockRef.current = setLock
    return () => {
      lockRef.current = null
    }
  }, [lockRef])
  return (
    <Animated.ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled
      scrollEnabled={!lock}
      showsHorizontalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEventThrottle={16}
      onScroll={onScroll}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </Animated.ScrollView>
  )
}
