import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { BED_FILES, BED_PAGE } from "./bedFiles";

// 홈 사진 칸의 침대(web/bed3d/photo). 시안과 같은 방 사진 1617장을 섞어 그리고, 앱이 지금 각도를 보내면 침대만 바뀐다.
// 페이지와 사진 묶음은 앱 안에 들어 있어 맥·보드·인터넷 연결 없이 뜬다(bedFiles.ts).
// 페이지가 파일을 달라고 하면 앱이 읽어서 넘겨준다(웹뷰에서 폰 안 파일을 직접 읽는 방식은 기기마다 달라 쓰지 않는다)
// 맥에서 페이지만 볼 때는 phone-app/web/bed3d에서 python3 -m http.server 8773 --bind 127.0.0.1

const readAsset = async (mod: number) => {
  const a = Asset.fromModule(mod);
  if (!a.localUri) await a.downloadAsync();
  return new File(a.localUri ?? a.uri).text();
};
let pageHtml: Promise<string> | null = null;

// 자세 탭이 움직임을 시작할 때 한 번만 부른다. 움직임은 3D 페이지가 앱과 같은 곡선으로 직접 그린다
// (움직이는 동안 매 장면 각도를 보내면 안드로이드에서 끊긴다)
type Inject = (js: string) => void;
let inject: Inject | null = null;
export const bed3d = {
  // 그 각도까지 ms 동안
  move: (head: number, leg: number, ms: number) =>
    inject?.(`window.moveBed&&window.moveBed(${head},${leg},${ms});true;`),
  // ±를 누르는 동안 1초에 15도씩
  hold: (part: "head" | "leg", dir: number) =>
    inject?.(`window.holdBed&&window.holdBed('${part}',${dir});true;`),
  // 그 각도로 바로(멈춤·끝)
  set: (head: number, leg: number) =>
    inject?.(`window.setBed&&window.setBed(${head},${leg});true;`),
};

// moving: 자세 탭이 움직이는 중이면 각도를 보내지 않는다(3D 페이지가 스스로 움직인다)
export function BedView({
  head,
  leg,
  moving,
}: {
  head: number;
  leg: number;
  moving: boolean;
}) {
  const web = useRef<ComponentRef<typeof WebView>>(null);
  // 처음 주소는 처음 각도로 한 번만 정한다(각도가 바뀔 때마다 페이지를 다시 읽지 않게).
  // t: 갤럭시 WebView가 저장해 둔 옛 페이지를 띄우지 않게 열 때마다 주소를 바꾼다(사진 묶음은 그대로 저장본을 쓴다)
  const [first] = useState(
    () => `window.__bedQuery='head=${head}&leg=${leg}';true;`,
  );
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    pageHtml ??= readAsset(BED_PAGE);
    let alive = true;
    pageHtml
      .then((h) => alive && setHtml(h))
      .catch((e) => console.warn("침대 페이지를 읽지 못했어요", e));
    return () => {
      alive = false;
    };
  }, []);
  // 페이지가 달라고 한 파일을 읽어 넘겨준다. 없으면 null을 넘겨 페이지가 실패로 처리한다
  const send = (name: string) => {
    const mod = BED_FILES[name];
    const done = (text: string | null) =>
      web.current?.injectJavaScript(
        `window.__bedFile(${JSON.stringify(name)},${JSON.stringify(text)});true;`,
      );
    if (mod == null) return done(null);
    readAsset(mod).then(done, (e) => {
      console.warn("사진 묶음을 읽지 못했어요", name, e);
      done(null);
    });
  };
  useEffect(() => {
    inject = (js) => web.current?.injectJavaScript(js);
    return () => {
      inject = null;
    };
  }, []);
  // 멈춰 있을 때 각도가 다르면 맞춘다(되돌리기 끝·연결 끊김 등)
  useEffect(() => {
    if (!moving) bed3d.set(head, leg);
  }, [head, leg, moving]);
  return (
    // 누르기·넘기기는 사진 칸 아래로 그대로 지나간다
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {html != null && (
        <WebView
          ref={web}
          source={{ html: html ?? "" }}
          injectedJavaScriptBeforeContentLoaded={first}
          style={styles.web}
          originWhitelist={["*"]}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled
          mixedContentMode="always"
          androidLayerType="hardware"
          // 페이지가 준비되면 지금 각도를 다시 보낸다
          onMessage={(e) => {
            const d = e.nativeEvent.data;
            if (d === "ready") return bed3d.set(head, leg);
            try {
              const m = JSON.parse(d);
              if (typeof m.load === "string") send(m.load);
            } catch {
              // 다른 글은 무시한다
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "transparent" },
});
