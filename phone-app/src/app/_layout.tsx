import { useFonts } from 'expo-font'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DevTools } from '@/dev/DevTools' // 개발용 시험 도구(떼려면 이 줄과 아래 <DevTools />를 지운다)
import { startBoardLink } from '@/features/bed/boardLink'
import { color } from '@/theme/tokens'

export default function RootLayout() {
  useEffect(() => startBoardLink(), [])
  const [loaded] = useFonts({
    'Pretendard-Thin': require('../../assets/fonts/Pretendard-Thin.ttf'),
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
  })
  if (!loaded) return null

  return (
    // 갤럭시에서 끝까지 당길 때 튕기는 움직임(PullScroll)이 손동작을 받으려면 맨 바깥에 있어야 한다
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
        <DevTools />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
