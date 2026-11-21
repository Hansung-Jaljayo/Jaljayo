import * as Linking from 'expo-linking'
import { useEffect } from 'react'

import { goOb, type ObState, setFlow } from '@/features/app/flow'
import { setBedInfo, setNightOverride, wardDefault } from '@/features/bed/bed'

// 개발 빌드에서 앱 주소에 ?scene=이름 을 붙여 열면 그 화면을 바로 띄운다(화면을 차례로 캡처해 시안과 맞대어 볼 때 쓴다).
// 예: exp://127.0.0.1:8081?scene=swap  ·  &ward=1 병원용 침대  ·  &night=1 지금 밤 시간
// scene=home·alarm·resv 는 그 탭, scene=settings 는 설정 화면
const SCENES: ObState[] = [
  'splash', 'scan', 'swap', 'kicked', 'notfound', 'nocam', 'nolan', 'confirming', 'confirmfail',
  'wjoin', 'wjoinfail', 'wlist', 'wpass', 'wmove', 'wfail', 'upapp', 'upboard', 'name', 'night',
  'ended', 'done', 'apw', 'admin', 'abeds', 'apwc',
]

export function useDevScene() {
  const url = Linking.useURL()
  useEffect(() => {
    if (!__DEV__ || !url) return
    const q = Linking.parse(url).queryParams ?? {}
    const scene = typeof q.scene === 'string' ? q.scene : null
    if (!scene) return
    setBedInfo({ ward: q.ward === '1' ? wardDefault() : null, registered: true, connected: true })
    setNightOverride(q.night === '1' ? true : null)
    setFlow({ settings: scene === 'settings', doc: null, tabAsk: { key: scene === 'alarm' || scene === 'resv' ? scene : 'pose', n: Date.now() } })
    if (scene === 'home' || scene === 'settings' || scene === 'alarm' || scene === 'resv') goOb(null)
    else if ((SCENES as string[]).includes(scene)) goOb(scene as ObState)
  }, [url])
}
