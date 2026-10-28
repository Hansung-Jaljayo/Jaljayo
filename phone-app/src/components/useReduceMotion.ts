import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

// 기기의 "동작 줄이기"가 켜져 있는지
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])
  return reduceMotion
}
