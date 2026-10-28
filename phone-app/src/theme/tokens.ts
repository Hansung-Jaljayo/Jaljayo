// 피그마 "디자인 기초" 값. 이름은 피그마 변수 이름을 그대로 따른다.

export const color = {
  bg: '#f4f0ed',
  card: '#fffcfa',
  inset: '#f0eae6',
  ink: '#342724',
  fg: '#2d2220',
  'fg-2': '#513e39',
  muted: '#705a54',
  'on-ink': '#fffaf7',
  'on-ink-muted': '#ead9d2',
  accent: '#ecb0a0',
  'accent-strong': '#d9816d',
  red: '#ad332c',
  // 컴포넌트 안에서만 쓰는 값
  backdrop: 'rgba(28, 20, 18, 0.55)',
  grab: '#cbbdb7',
  line: '#e2d8d3',
  switchOff: '#d8ccc6',
  // 고를 수 없는 날·달 버튼
  disabled: '#c4b6b0',
  white: '#ffffff',
} as const

export const space = {
  2: 2,
  4: 4,
  5: 5,
  6: 6,
  8: 8,
  12: 12,
  16: 16,
} as const

export const radius = {
  3: 3,
  16: 16,
  18: 18,
  19: 19,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
  30: 30,
  34: 34,
} as const

// 피그마 효과 스타일 "그림자/…"
export const shadow = {
  card: '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
  sheetTop: '0px 4px 12px -6px rgba(52, 39, 36, 0.35)',
  switchKnob: '0px 2px 6px 0px rgba(0, 0, 0, 0.25)',
  wheelPick: '0px 1px 3px 0px rgba(52, 39, 36, 0.12)',
} as const

export const font = {
  extraLight: 'Pretendard-ExtraLight',
  light: 'Pretendard-Light',
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const

// 시안의 움직임 곡선
export const motion = {
  sheetOpen: { duration: 500, bezier: [0.32, 0.72, 0, 1] },
  sheetClose: { duration: 350, bezier: [0.4, 0, 1, 1] },
  backdrop: { duration: 400 },
  switch: { duration: 250, bezier: [0.32, 0.72, 0, 1] },
  rippleIn: { duration: 420, bezier: [0.2, 0.8, 0.2, 1] },
  rippleOut: { duration: 260 },
  // 목록 줄 펼침: 칸이 늘고 줄면서 화살표가 아래로 돈다
  rowPanel: { duration: 550, bezier: [0.4, 0, 0.2, 1] },
  rowArrow: { duration: 450, bezier: [0.4, 0, 0.2, 1] },
} as const
