// 화면에 쓰는 선 아이콘(24x24). 이모지 대신 SVG를 쓴다
type P = { size?: number }
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true })

export const IconBed = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" /><path d="M3 14h18" /><path d="M7 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3" /><path d="M3 18v2M21 18v2" /></svg>
)
export const IconAlarm = ({ size = 20 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="13" r="7" /><path d="M12 10v3l2 2" /><path d="M5 4 3 6M19 4l2 2" /></svg>
)
export const IconClock = ({ size = 20 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconSensor = ({ size = 20 }: P) => (
  <svg {...base(size)}><rect x="3" y="10" width="18" height="6" rx="2" /><path d="M8 7l1 3M16 7l-1 3M12 6v4" /></svg>
)
export const IconStop = ({ size = 22 }: P) => (
  <svg {...base(size)}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
)
export const IconMic = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)
export const IconSpeaker = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
)
export const IconChip = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>
)
export const IconPlus = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconMinus = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M5 12h14" /></svg>
)
export const IconArrow = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

// 잘자요 마크: 머리판을 올린 모션베드 옆모습과 초승달(public/logo.svg와 같은 그림)
// 앱과 같은 로고(펠트 침대 그림)
export const Logo = ({ size = 40 }: P) => (
  <img src={`${import.meta.env.BASE_URL}logo.png`} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: size * 0.24 }} />
)
