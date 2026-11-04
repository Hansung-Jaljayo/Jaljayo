import { useEffect } from 'react'
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native'

import { color, font, radius, shadow, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'

type Props = {
  open: boolean
  title: string
  message: string
  // 오른쪽 진한 버튼 글
  okLabel?: string
  // 왼쪽 회색 버튼 글. 없으면 진한 버튼 하나만
  noLabel?: string
  onOk: () => void
  // 회색 버튼·뒤로 가기
  onClose: () => void
}

// 피그마 "dlg · 확인 창": 화면 가운데 상자에 제목·설명과 버튼. 바탕을 눌러서는 닫히지 않는다
export function ConfirmDialog({ open, title, message, okLabel = '확인', noLabel, onOk, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [open, onClose])

  if (!open) return null

  return (
    <View style={[StyleSheet.absoluteFill, styles.back]}>
      {/* 화면이 작거나 글자가 커서 상자가 넘치면 굴려 볼 수 있다. 넘치지 않으면 가운데 */}
      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        {/* dbox · 확인 창 상자 */}
        <View style={styles.box} role="alertdialog" aria-modal accessibilityLabel={title}>
          <Text style={styles.title} role="heading">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          {/* dacts · 버튼 줄 */}
          <View style={styles.acts}>
            {noLabel && (
              <RippleButton style={[styles.action, styles.gray]} rippleColor={color.fg} onPress={onClose}>
                <Text style={[styles.actionText, styles.grayText]}>{noLabel}</Text>
              </RippleButton>
            )}
            <RippleButton style={styles.action} rippleColor={color['on-ink']} onPress={onOk}>
              <Text style={styles.actionText}>{okLabel}</Text>
            </RippleButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  back: { backgroundColor: color.backdrop },
  center: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  box: {
    backgroundColor: color.card,
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: space[8],
    boxShadow: shadow.card,
  },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, color: color.fg, textAlign: 'center' },
  message: {
    marginBottom: space[8],
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22.5,
    color: color.muted,
    textAlign: 'center',
  },
  acts: { flexDirection: 'row', gap: space[8] },
  action: {
    flex: 1,
    height: 56,
    paddingHorizontal: space[6],
    borderRadius: radius[18],
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: font.bold, fontSize: 17, color: color['on-ink'] },
  gray: { backgroundColor: color.inset },
  grayText: { color: color.fg },
})
