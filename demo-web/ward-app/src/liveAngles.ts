// 11/17: 보드에 붙은 침대의 각도를 3D 화면이 매 프레임 직접 계산해 읽는 곳(가정용 화면처럼 그리는 순간의 위치).
// React 상태로 자주 다시 그리면 끊기므로 숫자·막대용 상태는 움직이기 시작·멈출 때만 바꾼다. null이면 화면 자체 상태(useBed)를 쓴다
import type { Angles } from './engine'
export const liveAngles: ((() => Angles) | null)[] = [null, null, null]
