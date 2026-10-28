import { useCallback, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

import { AlarmSheet } from '@/features/alarm/AlarmSheet'
import { color } from '@/theme/tokens'

// 임시 첫 화면: "알람 창 / 한 번 알람"을 바로 띄워 본다.
// 알람 탭(뒤에 깔리는 화면)이 만들어지면 그 탭의 "알람 추가" 버튼이 이 창을 연다.
export default function Index() {
  const [open, setOpen] = useState(true)
  const close = useCallback(() => setOpen(false), [])
  return (
    // 닫은 뒤 빈 바탕을 누르면 다시 연다(알람 탭이 생기기 전까지 확인용)
    <Pressable style={styles.bg} onPress={() => setOpen(true)}>
      <AlarmSheet open={open} onClose={close} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: color.bg },
})
