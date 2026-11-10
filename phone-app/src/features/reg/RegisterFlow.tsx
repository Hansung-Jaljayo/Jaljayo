import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState, Easing, Linking, StyleSheet, View } from 'react-native'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ObScreen } from '@/components/ObScreen'
import { useReduceMotion } from '@/components/useReduceMotion'
import { getFlow, goOb, innerBack, type ObState, openSettings, setFlow, useFlow } from '@/features/app/flow'
import { type BedInfo, getBedInfo, setBedInfo, wardDefault } from '@/features/bed/bed'
import { type BedReply } from '@/features/bed/requests'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { getHospital, setHospital } from '@/features/hospital/hospital'
import AppUpdateScreen from '@/screens/AppUpdateScreen'
import BedFirmwareUpdateScreen from '@/screens/BedFirmwareUpdateScreen'
import BedNotFoundScreen from '@/screens/BedNotFoundScreen'
import BedWifiConnectFailScreen from '@/screens/BedWifiConnectFailScreen'
import BedWifiConnectingScreen from '@/screens/BedWifiConnectingScreen'
import CameraPermissionScreen from '@/screens/CameraPermissionScreen'
import DisconnectedByOtherPhoneScreen from '@/screens/DisconnectedByOtherPhoneScreen'
import LocalNetworkPermissionScreen from '@/screens/LocalNetworkPermissionScreen'
import QRScanScreen from '@/screens/QRScanScreen'
import RegisterFailScreen from '@/screens/RegisterFailScreen'
import RegisteringScreen from '@/screens/RegisteringScreen'
import RegisterOtherDeviceScreen from '@/screens/RegisterOtherDeviceScreen'
import RegisterSuccessScreen from '@/screens/RegisterSuccessScreen'
import StartScreen from '@/screens/StartScreen'
import WifiConnectFailScreen from '@/screens/WifiConnectFailScreen'
import WifiConnectingScreen from '@/screens/WifiConnectingScreen'
import WifiPasswordScreen from '@/screens/WifiPasswordScreen'
import WifiSelectScreen from '@/screens/WifiSelectScreen'

import { AdminBed, AdminBeds, AdminHome, AdminPassword, AdminPasswordChange, NightInfo } from './HospitalAdmin'
import { NamePick } from './NamePick'
import { cssEase } from '@/theme/tokens'

// 시안 CSS ease
const EASE = Easing.bezier(...cssEase)

// 시작 화면을 보여 주는 시간. 그사이 침대 정보를 불러온다
const SPLASH_MS = 900
// 침대가 공유기 와이파이로 옮기는 데 1분쯤 걸린다
const WIFI_MOVE_MS = 90000

// 등록 흐름에서 화면을 오가며 기억하는 값
type Reg = {
  qr: string
  // 찾은 침대가 다른 폰에 등록돼 있는지(연결하면 원래 폰은 조작할 수 없다)
  taken: boolean
  // 찾은 침대가 병원용이면 병원에서 정한 이름
  wardName: string | null
  ssid: string
  wifiBad: boolean
  networks: string[]
  // 설정의 "다시 등록"으로 연 QR 화면인지(뒤로 가면 원래 등록이 살아 있는 홈으로)
  fromApp: boolean
  renaming: boolean
  // 다른 폰에서 넘겨받은 병원 침대면 쓰던 이름을 이름 고르기에서 미리 골라 둔다
  keepName: string
  // 침대를 찾는 동안 그대로 보여 줄 화면(QR 화면·못 찾음 화면·와이파이 옮기는 중)
  findFrom: 'scan' | 'notfound' | 'wmove'
}
const REG0: Reg = { qr: '', taken: false, wardName: null, ssid: '', wifiBad: false, networks: [], fromApp: false, renaming: false, keepName: '', findFrom: 'scan' }

// 침대 답에서 병원용 정보를 읽는다(형식은 보드 담당 규격을 따른다)
const wardFrom = (reply: BedReply): BedInfo['ward'] =>
  reply.ward ? { ...wardDefault(typeof reply.name === 'string' ? reply.name : '사과'), ...(typeof reply.ward === 'object' ? reply.ward : {}) } : null

// 등록·오류·병원 관리 화면을 탭 위에 덮는다
export function RegisterFlow() {
  const { ob } = useFlow()
  // 사라지는 중인 화면: 시작 화면은 0.3초 동안 흐려지고(그 아래 다음 화면이 보인다),
  // 등록 화면이 앱으로 넘어갈 때는 0.35초 동안 흐려지며 12 내려간다(시안 .splash.leave, .ob.leave)
  const [prevOb, setPrevOb] = useState(ob)
  const [leave, setLeave] = useState<{ key: ObState; n: number } | null>(null)
  if (ob !== prevOb) {
    setPrevOb(ob)
    if (prevOb === 'splash') setLeave({ key: 'splash', n: (leave?.n ?? 0) + 1 })
    else if (prevOb && !ob) setLeave({ key: prevOb, n: (leave?.n ?? 0) + 1 })
    else if (leave && leave.key !== 'splash') setLeave(null)
  }
  const [reg, setRegState] = useState<Reg>(REG0)
  const regRef = useRef(reg)
  const setReg = useCallback((patch: Partial<Reg>) => {
    regRef.current = { ...regRef.current, ...patch }
    setRegState(regRef.current)
  }, [])
  const [store, setStore] = useState(false)
  const r = useBedRequest()

  const toApp = useCallback(() => {
    r.cancel()
    setReg({ renaming: false, fromApp: false })
    goOb(null)
  }, [r, setReg])

  // 시작 화면 → 등록된 침대가 있으면 홈, 없으면 QR 화면
  useEffect(() => {
    if (ob !== 'splash') return
    const t = setTimeout(() => goOb(getBedInfo().registered ? null : 'scan'), SPLASH_MS)
    return () => clearTimeout(t)
  }, [ob])

  // 설정 앱에서 권한을 켜고 돌아오면 QR 화면부터 다시 확인한다(여전히 꺼져 있으면 권한 화면으로 돌아온다)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && (getFlow().ob === 'nocam' || getFlow().ob === 'nolan')) goOb('scan')
    })
    return () => sub.remove()
  }, [])

  // 화면마다 침대에 보내는 요청. 화면에 들어올 때 한 번 보낸다
  const register = useCallback(() => {
    goOb('confirming')
    r.send(
      { type: 'bed-register', body: { qr: regRef.current.qr, replace: regRef.current.taken } },
      (reply) => {
        if (reply.update === 'app') return goOb('upapp')
        if (reply.update === 'board') return goOb('upboard')
        const ward = wardFrom(reply)
        setBedInfo({
          registered: true,
          connected: true,
          ward,
          firmware: typeof reply.firmware === 'string' ? reply.firmware : getBedInfo().firmware,
        })
        setReg({ taken: false, keepName: regRef.current.taken && ward ? ward.name : '' })
        // 병원용이면 이름부터 고른다. 다른 폰에서 넘겨받은 침대는 쓰던 이름을 미리 골라 둔다
        goOb(ward ? 'name' : 'done')
      },
      () => goOb('confirmfail'),
    )
  }, [r, setReg])

  const find = useCallback(() => {
    const cur = getFlow().ob
    setReg({ findFrom: cur === 'notfound' || cur === 'wmove' ? cur : 'scan' })
    goOb('finding')
    r.send(
      { type: 'bed-find', body: { qr: regRef.current.qr } },
      (reply) => {
        setReg({ taken: !!reply.taken, wardName: typeof reply.name === 'string' && reply.ward ? reply.name : null })
        // 다른 폰에 등록된 침대면 먼저 묻고, 아니면 바로 이 폰을 등록한다(등록 확인 중 화면)
        if (reply.taken) goOb('swap')
        else register()
      },
      () => goOb('notfound'),
    )
  }, [r, setReg, register])

  // 와이파이 찾기: 목록을 받은 뒤에 목록 화면을 보여 준다(받기 전에 "찾지 못했어요"가 비치지 않게).
  // 목록 화면의 다시 찾기는 화면을 그대로 두고 링크만 "찾는 중…"으로 바뀐다(시안 data-ob-refresh)
  const wifiScan = useCallback(() => {
    const show = (networks: string[]) => {
      setReg({ networks })
      goOb('wlist')
    }
    r.send(
      { type: 'wifi-scan', body: null },
      (reply) => show(Array.isArray(reply.networks) ? (reply.networks as string[]) : []),
      () => {
        r.cancel()
        show([])
      },
    )
  }, [r, setReg])

  const wifiJoin = useCallback(() => {
    goOb('wjoin')
    r.send({ type: 'wifi-join', body: null }, () => wifiScan(), () => goOb('wjoinfail'))
  }, [r, wifiScan])

  const wifiSet = useCallback(
    (password: string) => {
      goOb('wmove')
      r.send(
        { type: 'wifi-set', body: { ssid: regRef.current.ssid, password } },
        (reply) => {
          if (reply.ok === false && reply.reason === 'password') {
            setReg({ wifiBad: true })
            return goOb('wpass')
          }
          if (reply.ok === false) return goOb('wfail')
          find()
        },
        () => goOb('wfail'),
        WIFI_MOVE_MS,
      )
    },
    [r, setReg, find],
  )

  const restart = useCallback(() => {
    r.cancel()
    setReg({ ...REG0 })
    goOb('scan')
  }, [r, setReg])

  // 병원 관리를 나가면 들어오기 전 화면으로. 그사이 이 폰의 침대 사용을 끝냈으면 "사용을 끝낸 침대"
  const adminExit = useCallback(() => {
    const h = getHospital()
    if (h.endedMine) {
      setHospital({ endedMine: false })
      setBedInfo({ registered: false })
      setFlow({ wipe: getFlow().wipe + 1 })
      return goOb('ended')
    }
    goOb((h.back as ObState | null) ?? null)
  }, [])

  // 설정 화면이 부르는 동작을 이 화면의 상태에 잇는다
  useEffect(() => {
    regApi.current = {
      restart,
      setFromApp: (on) => setReg({ fromApp: on }),
      setRenaming: (on) => setReg({ renaming: on }),
    }
    // 개발용 시험 도구가 등록 흐름의 한 단계부터 시작할 때 쓴다
    regDev.current = {
      scanned: (qr) => {
        setReg({ qr })
        find()
      },
      wifiJoin,
      wifiSet,
      patch: (p) => setReg(p),
    }
  }, [restart, setReg, find, wifiJoin, wifiSet])

  // 갤럭시 뒤로 버튼: 지금 덮은 화면에서 한 단계 뒤로. 기다리는 중인 화면은 막는다
  useEffect(() => {
    obBack.current = () => {
      const cur = getFlow().ob
      if (!cur) return false
      if (innerBack.current?.()) return true
      const back: Partial<Record<ObState, () => void>> = {
        apw: adminExit,
        admin: adminExit,
        abeds: () => goOb('admin'),
        abed: () => goOb('abeds'),
        apwc: () => goOb('admin'),
        night: toApp,
        swap: restart,
        wpass: () => goOb('wlist'),
        wlist: restart,
        done: toApp,
        name: () => (regRef.current.renaming ? toApp() : restart()),
      }
      if (['splash', 'finding', 'confirming', 'wjoin', 'wmove'].includes(cur)) return true
      if (back[cur]) {
        back[cur]!()
        return true
      }
      if (cur === 'scan') {
        if (regRef.current.fromApp) {
          toApp()
          return true
        }
        return false // 첫 화면: 한 번 더 누르면 앱을 닫는다(index에서 처리)
      }
      restart() // 오류·권한·업데이트 화면은 QR 화면으로
      return true
    }
  }, [adminExit, restart, toApp])

  if (!ob && !leave) return null

  const settings = openSettings
  const screenFor = (ob: ObState) => {
    switch (ob) {
      case 'splash':
        return <StartScreen />
      case 'scan':
      case 'finding':
        if (ob === 'finding' && reg.findFrom === 'notfound') {
          return <BedNotFoundScreen finding onSettings={settings} />
        }
        if (ob === 'finding' && reg.findFrom === 'wmove') return <BedWifiConnectingScreen ssid={reg.ssid} />
        return (
          <QRScanScreen
            onScanned={(qr) => {
              setReg({ qr })
              find()
            }}
            onDenied={() => goOb('nocam')}
            onSettings={settings}
          />
        )
      case 'swap':
        return (
          <RegisterOtherDeviceScreen
            description={`이 폰으로 연결하면 원래 폰으로는 조작할 수 없어요.${
              reg.wardName
                ? `\n이 침대의 알람, 예약, 자세 기록은 지워져요. 부르는 이름 '${reg.wardName} 침대'는 그대로 이어서 쓸 수 있어요.`
                : ''
            }`}
            onRetry={register}
            onHome={restart}
          />
        )
      case 'kicked':
        return (
          <DisconnectedByOtherPhoneScreen
            onRetry={() => {
              setReg({ taken: true })
              goOb('scan')
            }}
            onSettings={settings}
          />
        )
      case 'notfound':
        return <BedNotFoundScreen onRetry={find} onHome={restart} onWifiSetup={wifiJoin} onSettings={settings} />
      case 'nocam':
        return <CameraPermissionScreen onRetry={() => Linking.openSettings()} onSettings={settings} />
      case 'nolan':
        return <LocalNetworkPermissionScreen onRetry={() => Linking.openSettings()} onSettings={settings} />
      case 'confirming':
        return <RegisteringScreen />
      case 'confirmfail':
        return <RegisterFailScreen onRetry={register} onHome={restart} onSettings={settings} />
      case 'wjoin':
        return <WifiConnectingScreen ssid={`잘자요-${(reg.qr.match(/\d+/g)?.pop() ?? '').padStart(4, '0')}`} />
      case 'wjoinfail':
        return <WifiConnectFailScreen onRetry={wifiJoin} onHome={restart} onSettings={settings} />
      case 'wlist':
        return (
          <WifiSelectScreen
            networks={reg.networks}
            onSelect={(ssid) => {
              setReg({ ssid, wifiBad: false })
              r.cancel()
              goOb('wpass')
            }}
            onRescan={wifiScan}
            scanning={r.waiting}
            onHome={restart}
          />
        )
      case 'wpass':
        return <WifiPasswordScreen key={reg.ssid} ssid={reg.ssid} error={reg.wifiBad} onConnect={wifiSet} onBack={() => goOb('wlist')} />
      case 'wmove':
        return <BedWifiConnectingScreen ssid={reg.ssid} />
      case 'wfail':
        return <BedWifiConnectFailScreen onRetry={wifiJoin} onHome={() => goOb('wlist')} onSettings={settings} />
      case 'upapp':
        return <AppUpdateScreen onRetry={() => setStore(true)} onSettings={settings} />
      case 'upboard':
        return <BedFirmwareUpdateScreen onRetry={settings} onSettings={settings} />
      case 'name':
        return <NamePick renaming={reg.renaming} preset={reg.keepName} onDone={() => (reg.renaming ? toApp() : goOb('done'))} onCancel={() => (reg.renaming ? toApp() : restart())} />
      case 'night':
        return <NightInfo onOk={toApp} />
      case 'ended':
        return (
          <ObScreen
            icon={require('../../../assets/images/warn.png')}
            bad
            title="병원에서 사용을 끝낸 침대예요"
            lead="이 침대의 알람, 예약, 자세 기록이 지워졌어요. 다시 쓰려면 침대 QR을 찍어 등록해 주세요."
            primary={{ label: '다시 등록', onPress: restart }}
            links={[{ label: '설정', onPress: settings }]}
          />
        )
      case 'done': {
        const w = getBedInfo().ward
        return (
          <RegisterSuccessScreen
            description={`이제 이 폰으로 침대를 움직일 수 있어요.${w ? `\n'${w.name} 침대'라고 부르면 "네, ${w.name} 침대예요" 하고 대답해요.` : ''}`}
            onStart={toApp}
          />
        )
      }
      case 'apw':
        return <AdminPassword onIn={() => goOb('admin')} onOut={adminExit} />
      case 'admin':
        return <AdminHome onBeds={() => goOb('abeds')} onPassword={() => goOb('apwc')} onOut={adminExit} />
      case 'abeds':
        return (
          <AdminBeds
            onBed={(id) => {
              setHospital({ bedId: id })
              goOb('abed')
            }}
            onBack={() => goOb('admin')}
          />
        )
      case 'abed':
        return <AdminBed key={getHospital().bedId ?? 0} onBack={() => goOb('abeds')} />
      case 'apwc':
        return <AdminPasswordChange onDone={() => goOb('admin')} onCancel={() => goOb('admin')} />
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {ob && screenFor(ob)}
      {leave && (
        <Leaving key={leave.n} splash={leave.key === 'splash'} onDone={() => setLeave(null)}>
          {screenFor(leave.key)}
        </Leaving>
      )}
      <ConfirmDialog
        open={store}
        title="스토어로 이동"
        message="앱 스토어 주소가 정해지면 여기서 바로 열어요."
        onOk={() => setStore(false)}
        onClose={() => setStore(false)}
      />
    </View>
  )
}

// 사라지는 화면 한 장(누를 수 없다)
function Leaving({ splash, onDone, children }: { splash: boolean; onDone: () => void; children: React.ReactNode }) {
  const reduceMotion = useReduceMotion()
  const [k] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(k, {
      toValue: 1,
      duration: !splash && reduceMotion ? 0 : splash ? 300 : 350,
      easing: EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone()
    })
    // 처음 한 번만 움직인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const opacity = k.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  const translateY = splash ? 0 : k.interpolate({ inputRange: [0, 1], outputRange: [0, 12] })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      {children}
    </Animated.View>
  )
}

// 설정 화면이 여는 흐름(설정 → 이름 바꾸기·밤 시간·다시 등록·등록 해제·초기화·병원 관리)
export const regActions = {
  rename: () => {
    regApi.current.setRenaming(true)
    goOb('name')
  },
  night: () => goOb('night'),
  reregister: () => {
    regApi.current.restart()
    regApi.current.setFromApp(true)
  },
  unregister: () => {
    setBedInfo({ registered: false })
    regApi.current.restart()
  },
  admin: () => {
    const cur = getFlow().ob
    setHospital({ back: cur && cur !== 'splash' ? cur : null })
    goOb('apw')
  },
}

// 뒤로 버튼 처리기(index의 뒤로 버튼이 부른다)
export const obBack: { current: () => boolean } = { current: () => false }
// 개발용: 시험 도구가 부르는 등록 흐름 단계(QR 읽음·와이파이 처음 설정·공유기 비밀번호 보냄·화면 값 바꾸기)
export const regDev: {
  current: {
    scanned: (qr: string) => void
    wifiJoin: () => void
    wifiSet: (password: string) => void
    patch: (p: { ssid?: string; wifiBad?: boolean; networks?: string[]; taken?: boolean }) => void
  } | null
} = { current: null }
const regApi: { current: { restart: () => void; setFromApp: (on: boolean) => void; setRenaming: (on: boolean) => void } } = {
  current: { restart: () => goOb('scan'), setFromApp: () => {}, setRenaming: () => {} },
}

