import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { BED_NS } from './bedImages'

const key = (h: number, l: number) => `h${String(h).padStart(2, '0')}_l${String(l).padStart(2, '0')}`
// 사진 원본 비율 1200×760
const IW = 1200
const IH = 760

// 각도 시트 미리보기(시안 drawBed, 배율 1.15): 사이 각도는 가까운 네 장을 섞는다
export function BedPreview({ head, leg }: { head: number; leg: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const h0 = Math.min(45, Math.floor(head / 15) * 15)
  const th = (head - h0) / 15
  const l0 = Math.min(35, Math.floor(leg / 5) * 5)
  const tl = (leg - l0) / 5
  const s = box.w ? Math.min(box.w / IW, box.h / IH) * 1.15 : 0
  const pic = { position: 'absolute' as const, width: IW * s, height: IH * s, left: (box.w - IW * s) / 2, top: (box.h - IH * s) / 2 + 3 }

  // 다리 한 칸(같은 다리 각도의 머리 두 장)
  const row = (l: number) => (
    <>
      <Image source={BED_NS[key(h0, l)]} style={pic} contentFit="contain" />
      {th > 0.002 && <Image source={BED_NS[key(h0 + 15, l)]} style={[pic, { opacity: th }]} contentFit="contain" />}
    </>
  )
  return (
    <View style={styles.fill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {s > 0 && (
        <>
          <View style={StyleSheet.absoluteFill}>{row(l0)}</View>
          {tl > 0.002 && (
            <View style={[StyleSheet.absoluteFill, { opacity: tl }]} needsOffscreenAlphaCompositing>
              {row(l0 + 5)}
            </View>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
