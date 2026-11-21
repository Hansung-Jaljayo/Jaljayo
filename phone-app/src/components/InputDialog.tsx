import { useEffect, useState } from 'react'
import { Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'

import { color, font, radius, shadow, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'

type Props = {
  open: boolean
  title: string
  message?: string
  // 열 때 칸에 들어 있을 값
  value: string
  placeholder?: string
  keyboardType?: TextInputProps['keyboardType']
  okLabel?: string
  noLabel?: string
  onOk: (text: string) => void
  // 취소·뒤로 가기
  onClose: () => void
}

// 확인 창(ConfirmDialog)과 같은 상자에 글 넣는 칸 하나. 키보드의 완료가 아니라 확인·취소 버튼으로만 끝낸다.
// 바탕을 눌러서는 닫히지 않는다. 키보드가 올라오면 키보드 높이만큼 비워 상자가 키보드 위에 온다
// (기본 KeyboardAvoidingView는 화면을 끝까지 쓰는 갤럭시 설정에서 움직이지 않아 확인 버튼이 키보드에 가려졌다)
export function InputDialog({ open, title, message, value, placeholder, keyboardType, okLabel = '확인', noLabel = '취소', onOk, onClose }: Props) {
  const [text, setText] = useState(value)
  // 열 때마다 지금 값으로 시작한다
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setText(value)
  }

  const [kb, setKb] = useState(0)
  useEffect(() => {
    if (!open) return
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKb(e.endCoordinates.height),
    )
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [open])


  return (
    // 설정 화면처럼 시트·확인 창 층(PortalHost) 밖에서 열어도 화면 맨 위 가운데에 뜨도록 기본 팝업 층에 그린다
    <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.back, { paddingBottom: kb }]}>
        <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.box} role="dialog" aria-modal accessibilityLabel={title}>
            <Text style={styles.title} role="heading">
              {title}
            </Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={color.muted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={keyboardType}
              accessibilityLabel={title}
            />
            <View style={styles.acts}>
              <RippleButton style={[styles.action, styles.gray]} rippleColor={color.fg} onPress={onClose}>
                <Text style={[styles.actionText, styles.grayText]}>{noLabel}</Text>
              </RippleButton>
              <RippleButton style={styles.action} rippleColor={color['on-ink']} onPress={() => onOk(text.trim())}>
                <Text style={styles.actionText}>{okLabel}</Text>
              </RippleButton>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  message: { fontFamily: font.regular, fontSize: 15, lineHeight: 22.5, color: color.muted, textAlign: 'center' },
  input: {
    height: 56,
    marginBottom: space[8],
    paddingHorizontal: 16,
    borderRadius: radius[18],
    backgroundColor: color.inset,
    fontFamily: font.medium,
    fontSize: 17,
    color: color.fg,
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
