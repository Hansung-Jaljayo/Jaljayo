// 11/17 병원 시연 보드 연결: 침대 세 대가 각자 이름 붙은 접속으로 보드에 붙는 "침대 제어부" 역할을 한다
// (docs/interfaces/board-link.md 병상용 절). 보드가 bed-move·bed-stop을 보내면 그 침대만 초당 6도로 움직이고,
// 움직이는 동안 0.2초마다, 끝날 때 결과를 채워 bed-state를 돌려준다. 화면은 onAngles로 각도를 받아 그린다
import type { Angles } from './engine'

const SPEED = 6          // 도/초. 보드 시뮬레이션(BedSim)과 같은 속도
const REPORT_MS = 200    // 움직이는 동안 bed-state 보내는 간격
const TICK_MS = 16      // 화면이 부드럽게 따라오도록 초당 약 60번
const ACCEL = SPEED / 0.25   // 0.25초 만에 최고 속도. 가정용 화면과 같은 출발·멈춤

export class BedPort {
  private ws: WebSocket | null = null
  private closed = false
  private id = 0
  private a: Angles = { head: 0, leg: 0 }
  private t: Angles = { head: 0, leg: 0 }
  private v: Angles = { head: 0, leg: 0 }   // 지금 속도(도/초)
  private timer: number | null = null
  private lastReport = 0
  private last = 0
  linked = false

  constructor(private url: string, readonly name: string, private onAngles: (a: Angles, moving: boolean, t: Angles) => void, private onLink: (linked: boolean) => void) {}

  open() {
    const w = new WebSocket(this.url); this.ws = w
    w.onopen = () => { this.linked = true; this.onLink(true); this.send({ type: 'hello', role: 'bed', name: this.name }); this.report(null) }
    w.onclose = () => {
      this.linked = false; this.onLink(false); this.halt()
      if (!this.closed) setTimeout(() => this.open(), 1500)
    }
    w.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.type === 'bed-move') {
        this.id = m.id ?? this.id
        this.t = { head: Number(m.head), leg: Number(m.leg) }
        if (m.snap) { this.halt(); this.a = { ...this.t }; this.onAngles(this.a, false, this.t); this.report(null); return }
        this.run()
      } else if (m.type === 'bed-stop') {
        this.id = m.id ?? this.id
        this.halt(); this.t = { ...this.a }; this.onAngles(this.a, false, this.t); this.report('stopped')
      }
    }
  }

  close() { this.closed = true; this.halt(); this.ws?.close() }

  private send(o: object) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o)) }

  private dir(p: 'head' | 'leg') { const d = this.t[p] - this.a[p]; return Math.abs(d) < 1e-6 ? 'stop' : d > 0 ? 'up' : 'down' }

  private report(result: 'arrived' | 'stopped' | null) {
    this.lastReport = performance.now()
    this.send({ type: 'bed-state', id: this.id, head: round1(this.a.head), leg: round1(this.a.leg), targetHead: this.t.head, targetLeg: this.t.leg,
      headMove: this.dir('head'), legMove: this.dir('leg'), result })
  }

  /** 지금 시각까지 움직임을 진행하고 각도를 돌려준다. 3D 화면이 매 프레임 부르고, 보고용 타이머도 부른다(같은 계산이라 두 쪽이 어긋나지 않음) */
  advance(now = performance.now()): Angles {
    if (this.timer === null) return this.a
    let rest = Math.min(1, (now - this.last) / 1000); this.last = now
    // 목표까지 남은 거리로 멈출 수 있는 속도를 넘지 않게, 가속도 안에서 속도를 바꾼다. 도중에 목표가 바뀌어도 부드럽게 방향을 튼다
    const step = (p: 'head' | 'leg', dt: number) => {
      const d = this.t[p] - this.a[p]
      if (Math.abs(d) < 0.02 && Math.abs(this.v[p]) < ACCEL * dt * 2) { this.v[p] = 0; return this.t[p] }
      const want = Math.sign(d) * Math.min(SPEED, Math.sqrt(2 * ACCEL * Math.abs(d)))
      this.v[p] += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, want - this.v[p]))
      const nx = this.a[p] + this.v[p] * dt
      if ((this.t[p] - nx) * d < 0) { this.v[p] = 0; return this.t[p] }
      return nx
    }
    while (rest > 0) { const dt = Math.min(rest, 1 / 120); rest -= dt; this.a = { head: step('head', dt), leg: step('leg', dt) } }
    return this.a
  }

  private run() {
    if (this.timer !== null) return
    this.last = performance.now()
    this.timer = window.setInterval(() => {
      const now = performance.now()
      this.advance(now)
      const done = this.a.head === this.t.head && this.a.leg === this.t.leg
      this.onAngles(this.a, !done, this.t)
      if (done) { this.halt(); this.report('arrived') }
      else if (now - this.lastReport >= REPORT_MS) this.report(null)
    }, TICK_MS)
  }

  private halt() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null }; this.v = { head: 0, leg: 0 } }
}

const round1 = (x: number) => Math.round(x * 10) / 10
