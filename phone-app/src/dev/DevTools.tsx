import { setBedInfo, useBedInfo } from '@/features/bed/bed'

import { DevSwitch } from './DevSwitch'

// 개발할 때만 쓰는 시험 도구 모음. 침대가 알려 줄 정보를 손으로 바꿔 화면을 확인한다.
// 앱은 이 폴더를 모른다(침대 정보만 바꾼다). 떼려면 src/dev 폴더와 src/app/_layout.tsx의 DevTools 두 줄을 지우면 되고,
// 떼어도 앱은 침대 정보의 처음 값(버튼 있음)으로 그대로 움직인다
export function DevTools() {
  const bed = useBedInfo()
  if (!__DEV__) return null
  return (
    <DevSwitch
      label="버튼 없는 침대"
      value={!bed.hasButton}
      onValueChange={(on) => setBedInfo({ hasButton: !on })}
    />
  )
}
