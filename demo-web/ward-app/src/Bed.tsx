import type { Angles } from './engine'

type Props = { angles: Angles; occupied: boolean; ringing: boolean }

// 침대를 옆에서 본 그림. 머리판은 왼쪽 경첩, 다리판은 오른쪽 경첩을 축으로 각도만큼 들린다
const HEAD_HINGE = { x: 330, y: 238 }
const LEG_HINGE = { x: 470, y: 238 }
const PANEL = 200 // 머리판·다리판 길이
const THICK = 34 // 매트리스 두께

export function Bed({ angles, occupied, ringing }: Props) {
  const head = angles.head
  const leg = angles.leg
  return (
    <svg className="bed" viewBox="60 30 700 340" role="img" aria-label={`침대 그림. 머리 ${Math.round(head)}도, 다리 ${Math.round(leg)}도, ${occupied ? '누워 있음' : '비어 있음'}`}>
      <defs>
        <linearGradient id="mattress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E2E8F0" />
          <stop offset="1" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id="blanket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F59E0B" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 방 */}
      <g className="room">
        <rect x="560" y="40" width="150" height="110" rx="10" className="window" />
        <circle cx="665" cy="78" r="16" className="moon" />
        <circle cx="600" cy="70" r="1.6" className="star" />
        <circle cx="625" cy="110" r="1.2" className="star" />
        <circle cx="690" cy="125" r="1.4" className="star" />
        <line x1="40" y1="316" x2="760" y2="316" className="floor" />
      </g>
      {ringing && <circle cx="210" cy="150" r="100" fill="url(#lamp)" className="ring-glow" />}

      {/* 받침 */}
      <g className="frame">
        <rect x="120" y="238" width="560" height="22" rx="6" />
        <rect x="140" y="260" width="16" height="56" rx="3" />
        <rect x="644" y="260" width="16" height="56" rx="3" />
      </g>

      {/* 가운데 고정판 */}
      <rect x={HEAD_HINGE.x} y={HEAD_HINGE.y - THICK} width={LEG_HINGE.x - HEAD_HINGE.x} height={THICK} className="mattress" />

      {/* 다리판 */}
      <g transform={`rotate(${-leg} ${LEG_HINGE.x} ${LEG_HINGE.y})`}>
        <rect x={LEG_HINGE.x} y={LEG_HINGE.y - THICK} width={PANEL} height={THICK} rx="10" className="mattress" />
        {occupied && <rect x={LEG_HINGE.x - 4} y={LEG_HINGE.y - THICK - 26} width={PANEL - 26} height={26} rx="13" fill="url(#blanket)" />}
      </g>

      {/* 머리판 */}
      <g transform={`rotate(${head} ${HEAD_HINGE.x} ${HEAD_HINGE.y})`}>
        <rect x={HEAD_HINGE.x - PANEL} y={HEAD_HINGE.y - THICK} width={PANEL} height={THICK} rx="10" className="mattress" />
        <rect x={HEAD_HINGE.x - PANEL + 14} y={HEAD_HINGE.y - THICK - 16} width="74" height="18" rx="9" className="pillow" />
        {occupied && (
          <>
            <circle cx={HEAD_HINGE.x - PANEL + 52} cy={HEAD_HINGE.y - THICK - 30} r="20" className="person" />
            <rect x={HEAD_HINGE.x - PANEL + 78} y={HEAD_HINGE.y - THICK - 26} width={PANEL - 74} height={26} rx="13" fill="url(#blanket)" />
          </>
        )}
      </g>
      {occupied && <rect x={HEAD_HINGE.x - 6} y={HEAD_HINGE.y - THICK - 26} width={LEG_HINGE.x - HEAD_HINGE.x + 12} height={26} fill="url(#blanket)" />}

      {/* 경첩과 각도 */}
      <circle cx={HEAD_HINGE.x} cy={HEAD_HINGE.y} r="5" className="hinge" />
      <circle cx={LEG_HINGE.x} cy={LEG_HINGE.y} r="5" className="hinge" />
      <text x={HEAD_HINGE.x - 120} y={352} className="angle-label">머리 {Math.round(head)}°</text>
      <text x={LEG_HINGE.x + 60} y={352} className="angle-label">다리 {Math.round(leg)}°</text>
    </svg>
  )
}
