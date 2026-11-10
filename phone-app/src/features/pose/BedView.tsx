import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

// 홈 사진 칸의 침대(web/bed3d/photo). 시안과 같은 방 사진 1617장을 섞어 그리고, 앱이 지금 각도를 보내면 침대만 바뀐다.
// 지금은 개발용으로 맥에서 띄운 페이지를 읽는다: phone-app/web/bed3d에서
//   python3 -m http.server 8773 --bind 127.0.0.1
// 갤럭시 에뮬레이터는 adb reverse tcp:8773 tcp:8773 이 필요하다. 앱으로 빌드할 때는 페이지와 모델을 앱 안에 넣는다
export const BED3D_URL = 'http://127.0.0.1:8773/photo/'

// 자세 탭이 움직임을 시작할 때 한 번만 부른다. 움직임은 3D 페이지가 앱과 같은 곡선으로 직접 그린다
// (움직이는 동안 매 장면 각도를 보내면 안드로이드에서 끊긴다)
type Inject = (js: string) => void
let inject: Inject | null = null
export const bed3d = {
  // 그 각도까지 ms 동안
  move: (head: number, leg: number, ms: number) => inject?.(`window.moveBed&&window.moveBed(${head},${leg},${ms});true;`),
  // ±를 누르는 동안 1초에 15도씩
  hold: (part: 'head' | 'leg', dir: number) => inject?.(`window.holdBed&&window.holdBed('${part}',${dir});true;`),
  // 그 각도로 바로(멈춤·끝)
  set: (head: number, leg: number) => inject?.(`window.setBed&&window.setBed(${head},${leg});true;`),
}

// moving: 자세 탭이 움직이는 중이면 각도를 보내지 않는다(3D 페이지가 스스로 움직인다)
export function BedView({ head, leg, moving }: { head: number; leg: number; moving: boolean }) {
  const web = useRef<ComponentRef<typeof WebView>>(null)
  // 처음 주소는 처음 각도로 한 번만 정한다(각도가 바뀔 때마다 페이지를 다시 읽지 않게).
  // t: 갤럭시 WebView가 저장해 둔 옛 페이지를 띄우지 않게 열 때마다 주소를 바꾼다(사진 묶음은 그대로 저장본을 쓴다)
  const [first] = useState(() => `${BED3D_URL}?head=${head}&leg=${leg}&t=${Date.now()}`)
  useEffect(() => {
    inject = (js) => web.current?.injectJavaScript(js)
    return () => {
      inject = null
    }
  }, [])
  // 멈춰 있을 때 각도가 다르면 맞춘다(되돌리기 끝·연결 끊김 등)
  useEffect(() => {
    if (!moving) bed3d.set(head, leg)
  }, [head, leg, moving])
  return (
    // 누르기·넘기기는 사진 칸 아래로 그대로 지나간다
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={web}
        source={{ uri: first }}
        style={styles.web}
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        mixedContentMode="always"
        androidLayerType="hardware"
        // 페이지가 준비되면 지금 각도를 다시 보낸다
        onMessage={(e) => {
          if (e.nativeEvent.data === 'ready') bed3d.set(head, leg)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
})
