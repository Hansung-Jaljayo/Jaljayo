import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { TabKey } from '@/components/TabBar'
import { AlarmTab } from '@/features/alarm/AlarmTab'
import { closeSettings, getFlow, setFlow, useFlow } from '@/features/app/flow'
import { bedName, getBedInfo, setBedInfo, useBedInfo } from '@/features/bed/bed'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { CONTACT } from '@/features/hospital/hospital'
import { PoseTab } from '@/features/pose/PoseTab'
import { obBack, RegisterFlow, regActions } from '@/features/reg/RegisterFlow'
import { setResvState } from '@/features/resv/resv'
import { ResvTab } from '@/features/resv/ResvTab'
import OpenSourceScreen from '@/screens/OpenSourceScreen'
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import TermsScreen from '@/screens/TermsScreen'
import { color, font, radius } from '@/theme/tokens'

// 침대 상태를 읽는 시간. 침대와 주고받는 길이 생기면 침대가 상태를 보내 줄 때 loading을 끈다
const LOAD_MS = 2000

// 첫 화면: 자세 탭. 탭을 바꿔도 각 탭의 상태가 남도록 세 탭을 모두 그려 두고 고른 탭만 보인다.
// 등록·오류·병원 관리 화면과 설정 화면은 탭 위에 덮는다
export default function Index() {
  const [tab, setTab] = useState<TabKey>('pose')
  const flow = useFlow()
  const bed = useBedInfo()
  const reset = useBedRequest()
  const [resetFail, setResetFail] = useState(false)
  const [ringBlock, setRingBlock] = useState(false)
  const [toast, setToast] = useState('')
  const lastBack = useRef(0)

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
        setTab('pose')
        return true
      }
      const now = Date.now()
      if (now - lastBack.current < 2000) return false
      lastBack.current = now
      setToast('한 번 더 누르면 앱이 닫혀요')
      return true
    })
    return () => sub.remove()
  }, [tab])

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

  const pick = (key: TabKey) => setTab(key)
  // 설정을 등록 화면에서 열면 침대 묶음 없이 앱·병원 관리만
  const noBed = !!flow.ob && flow.ob !== 'splash'
  return (
    <View style={styles.fill}>
      <View style={styles.fill} key={flow.wipe}>
        <View style={[styles.fill, tab !== 'pose' && styles.hidden]}>
          <PoseTab onTab={pick} />
        </View>
        <View style={[styles.fill, tab !== 'alarm' && styles.hidden]}>
          <AlarmTab onTab={pick} />
        </View>
        <View style={[styles.fill, tab !== 'resv' && styles.hidden]}>
          <ResvTab onTab={pick} />
        </View>
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
      {!!toast && (
        <View style={styles.toast} pointerEvents="none" role="status">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
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
