import { useEffect, useRef, useState } from 'react'
import { type View } from './Ward3D'
import { BED_NAMES, Ward3D } from './Ward3D'
import { WARD_GROUPS, WARD_SCENES, type Command } from './commands'
import { DEFAULTS, LIMIT, alarmDue, alarmOff, interpret, pressButton, reservationDue, resetPose, savePose, toggleOccupied, type Part, type Purpose } from './engine'
import { useBed } from './useBed'
import { liveAngles } from './liveAngles'
import { createAlarmSound } from './alarmSound'
import { useMotorHum } from './sound'
import { BedPort } from './boardBeds'

// 자세 카드에 보이는 이름. 카드를 누르면 그 자세를 부르는 말(7차 학습 데이터의 실제 문장과 정답)을 한 것으로 처리해 모델 출력까지 보여 준다
const PRESETS: { key: Purpose; label: string; say: string }[] = [
  { key: 'read', label: '독서', say: '침대 독서 자세 해' },
  { key: 'tv', label: 'TV 시청', say: '침대 티비 자세 해' },
  { key: 'rest', label: '휴식', say: '휴식 자세 해줘' },
  { key: 'sleep', label: '수면', say: '잠 자세로 해줘' },
]
// 자세 탭의 자세 예약: 말로 거는 예약과 같은 문장·출력으로 처리한다
const RESERVE_TIMES: { label: string; say: string; time: string }[] = [
  { label: '10분 뒤', say: '십 분', time: '00:10' },
  { label: '30분 뒤', say: '삼십 분', time: '00:30' },
  { label: '1시간 뒤', say: '한 시간', time: '01:00' },
]
const RESERVE_SAY: Partial<Record<Purpose, string>> = { read: '독서', tv: '티비', rest: '휴식', sleep: '잠' }
const reserveCommand = (p: Purpose, t: typeof RESERVE_TIMES[number]): Command => ({ group: '예약', hint: '',
  heard: `${RESERVE_SAY[p]} 자세로 예약할게 시간은 ${t.say} 뒤야`,
  output: `<maum_0>(command=reserve, purpose=${p}, date=none, ampm=none, time=${t.time}, time_type=relative, confirm=no)<maum_end>` })
const CANCEL_RESERVE: Command = { group: '예약', hint: '', heard: '자세 예약 취소해 줘', output: '<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>' }
const RESERVE_NAME: Partial<Record<Purpose, string>> = { read: '독서 자세', tv: 'TV 자세', rest: '휴식 자세', sleep: '수면 자세', flat: '평평하게', base: '기본 자세' }
const callOutput = (p: Purpose) => `<maum_0>(command=call, purpose=${p}, confirm=no)<maum_end>`

// 오른쪽 조작 칸의 탭
// 시연은 말에서 시작하므로 '말하기'가 첫 탭(11/16)
const TABS = [
  { key: 'talk', label: '말하기' },
  { key: 'pose', label: '자세' },
  { key: 'device', label: '기기' },
] as const
type Tab = (typeof TABS)[number]['key']

// 3D 화면이 주인공인 배치(UI/UX Pro Max의 3D 컨피규레이터 배치)
// 침대는 화면 높이 전체, 조작은 오른쪽 칸 안에, 멈춤 버튼은 아래 바에 늘 보인다
export default function App() {
  // 침대 세 대(병원용 사과·포도·딸기)를 따로 움직인다. 가정용은 첫 번째 하나만 쓴다
  const beds = [useBed(), useBed(), useBed()]
  const [sel, setSel] = useState(0)
  const [view, setView] = useState<View>('default')
  const [viewTick, setViewTick] = useState(0)  // 같은 시점 버튼을 다시 눌러도 그 시점으로 돌아오게
  // 가정용(집 침실)이 기본, 병원용은 3인실 병실(침대 세 대가 따로 움직인다). 병원용을 누르면 3D 탭부터 보인다
  const ward = true
  const { state, moving, apply, stopHold } = beds[ward ? sel : 0]
  // 보드 연결 모드(?board=ws://주소:8765): 규칙은 보드 앱이 돌리고, 이 화면은 보드가 보낸 각도와 대화를 그대로 그린다
  const boardUrl = new URLSearchParams(window.location.search).get('board')
  const ws = useRef<WebSocket | null>(null)
  const [boardInfo, setBoardInfo] = useState('보드에 연결하는 중')
  const [always, setAlways] = useState(false)
  // 11/17 병원 시연: 침대 셋이 각자 이름 붙은 접속(침대 제어부 역할)으로 보드에 붙고, 보드가 보낸 이동 명령대로 그 침대만 움직인다.
  // 따로 여는 접속 하나(화면)는 보드 상태·대화를 받아 침대별 칸에 그리고, 말·버튼·시연 글을 보드에 보낸다
  const [boardMovingBeds, setBoardMovingBeds] = useState([false, false, false])
  const [linkedBeds, setLinkedBeds] = useState([false, false, false])
  const ports = useRef<BedPort[]>([])
  // 11/17: 화면에서 각도를 바꾸면 그 침대는 잠깐 화면 값을 우선한다(보드가 늦게 돌려주는 옛 목표로 막대가 튀지 않게)
  const holdUntil = useRef([0, 0, 0])
  const reqId = useRef(Math.floor(Date.now() % 1e6))
  const sendAt = useRef(0)
  const sendLater = useRef<number | null>(null)
  const pushedAt = useRef([0, 0, 0])
  const sendBoard = (o: object) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(o)) }
  const at = (bed: unknown) => { const i = BED_NAMES.indexOf(String(bed)); return i >= 0 ? i : -1 }
  useEffect(() => {
    if (!boardUrl) return
    let closed = false
    const set3 = <T,>(f: (fn: (v: T[]) => T[]) => void, i: number, x: T) => f(v => { if (v[i] === x) return v; const c = [...v]; c[i] = x; return c })
    ports.current = BED_NAMES.map((n, i) => new BedPort(boardUrl, n,
      (a, mv, t) => {
        const now = performance.now()
        if (mv && pushedAt.current[i] === 1) return   // 움직이는 동안은 다시 그리지 않는다(3D는 liveAngles로 매 프레임 직접 계산). 시작·멈출 때만
        pushedAt.current[i] = mv ? 1 : 0
        beds[i].apply(s => ({ ...s, angles: { ...a }, target: now < holdUntil.current[i] ? s.target : { ...t } })); set3(setBoardMovingBeds, i, mv)
      },
      (l) => { const p = ports.current[i]; liveAngles[i] = l && p ? () => p.advance() : null; set3(setLinkedBeds, i, l) }))
    // 11/17: 시연 화면 탭이 여러 개면 같은 이름 침대로 서로 밀어내며 1.5초마다 끊겼다 붙는다. 침대 역할은 한 탭만 맡는다(나머지 탭은 보기만)
    let release: (() => void) | null = null
    const openPorts = () => ports.current.forEach(p => p.open())
    if (navigator.locks) navigator.locks.request('jaljayo-ward-beds', () => new Promise<void>(res => { if (closed) { res(); return } release = res; openPorts() }))
    else openPorts()
    const open = () => {
      const w = new WebSocket(boardUrl); ws.current = w
      w.onopen = () => { setBoardInfo('보드 연결됨'); w.send(JSON.stringify({ type: 'time', epochMs: Date.now() })) }
      w.onclose = () => { setBoardInfo('보드 연결 끊김 · 다시 연결하는 중'); if (!closed) setTimeout(open, 1500) }
      w.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'state') {
          setBoardInfo(`보드 연결됨 · ${m.model}`)
          const ward: any[] = Array.isArray(m.ward) ? m.ward : []
          for (const b of ward) {
            const i = at(b.name); if (i < 0) continue
            const memory: Partial<Record<Purpose, { head: number; leg: number }>> = {}
            for (const [k, v] of Object.entries(b.presets ?? {})) if (v) memory[k as Purpose] = v as { head: number; leg: number }
            const own = ports.current[i]?.linked
            beds[i].apply(s => ({
              ...s, purpose: b.purpose ?? null, ringing: !!b.ringing, memory,
              pending: b.asking ? { kind: 'confirm', output: '' } : null,
              reservation: b.reservation ? { label: `${b.reservation.label}(${b.reservation.inMin}분 남음)`, mins: b.reservation.inMin, purpose: b.reservation.purpose, target: s.target } : null,
              alarm: b.alarms?.length ? { label: b.alarms[0].label, type: b.alarms[0].type } : null,
              // 이 화면의 침대 접속이 붙어 있지 않으면 보드 시뮬레이션 각도를 그대로 그린다
              ...(own ? {} : { angles: b.angles, target: b.angles }),
            }))
            if (!own) set3(setBoardMovingBeds, i, !!b.moving)
            if (b.active) setSel(i)
          }
        } else if (m.type === 'speech') {
          const i = at(m.bed); if (i >= 0) beds[i].apply((s) => ({ ...s, speech: m.say, note: '' }))
          setCalled(null)
        } else if (m.type === 'turn') {
          const i = at(m.bed); if (i < 0) return
          beds[i].apply((s) => ({ ...s, heard: m.heard, output: m.output ? `${m.output}${m.llmMs ? `  (${(m.llmMs / 1000).toFixed(2)}초)` : ''}` : '', speech: m.say, note: m.note }))
          setCalled(null)
        }
      }
    }
    open()
    return () => { closed = true; ws.current?.close(); ports.current.forEach(p => p.close()); ports.current = []; release?.(); liveAngles.fill(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardUrl])
  // 압력 센서: 시연 화면에서 "침대에서 나가기·눕기"를 한 번이라도 누른 침대만 그 값을 0.3초마다 보드에 보낸다(누르기 전에는 센서 없음)
  const sensorOn = useRef([false, false, false])
  const occ = beds.map(b => b.state.occupied)
  useEffect(() => {
    if (!boardUrl) return
    const t = window.setInterval(() => BED_NAMES.forEach((n, i) => { if (sensorOn.current[i]) sendBoard({ type: 'sensor', bed: n, occupied: occ[i], value: occ[i] ? 800 : 30, virtual: true }) }), 300)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardUrl, occ[0], occ[1], occ[2]])
  const [tab, setTab] = useState<Tab>('talk')
  // 손으로 끄는 동안은 막대가 손가락(목표)을 따르고, 그 밖에는 실제 각도를 매 프레임 따라간다
  const [, setBarDrag] = useState<Part | null>(null)
  // 저장 자세 버튼을 누를 때 할 일: 평소엔 그 자세로 이동, 'save'면 지금 각도를 저장, 'reset'이면 처음 값으로
  const [poseMode, setPoseMode] = useState<'save' | 'reset' | 'reserve' | null>(null)
  const [reservePick, setReservePick] = useState<Purpose | null>(null)
  useEffect(() => { setPoseMode(null); setReservePick(null) }, [sel, tab])
  // 침대가 움직이는 동안 모터 소리(기기 탭에서 끄고 켬)
  const [hum, setHum] = useState(true)
  const shownMoving = boardUrl ? boardMovingBeds[sel] : moving
  const partMoving = (part: Part) => beds.some(({ state, jogging }) =>
    jogging?.part === part || Math.abs(state.angles[part] - state.target[part]) > 0.01
  )
  useMotorHum(hum && (boardUrl ? boardMovingBeds.some(Boolean) : partMoving('head')), hum && !boardUrl && partMoving('leg'))
  // 알람: 어느 침대든 울리면 소리를 내고, 울리는 침대 이름표를 깜빡인다
  const ringBeds = beds.map(b => b.state.ringing)
  const anyRing = ringBeds.some(Boolean)
  const alarmSound = useRef<ReturnType<typeof createAlarmSound> | null>(null)
  useEffect(() => { alarmSound.current ??= createAlarmSound(); alarmSound.current.set(anyRing) }, [anyRing])
  useEffect(() => () => alarmSound.current?.set(false), [])
  // 이름 부르기 결과(모델 호출 없음). 다음 말을 하면 지운다
  const [called, setCalled] = useState<{ heard: string; reply: string } | null>(null)
  const ding = () => { try {
    const ac = new AudioContext(), t = ac.currentTime
    for (const [f, d] of [[1318.5, 0], [1760, .12]] as [number, number][]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = 'sine'
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.18, t + d + .01); g.gain.exponentialRampToValueAtTime(.001, t + d + .5)
      o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + .55)
    }
  } catch { /* 소리 못 내도 진행 */ } }
  const callName = (heard: string) => {
    if (boardUrl) { sendBoard({type:'text', text:heard}); return }
    const name = heard.replace(' 침대', ''), i = BED_NAMES.indexOf(name)
    if (i < 0) { setCalled({ heard, reply: `이 병실에 ${name} 침대가 없어서 아무 침대도 대답하지 않아요` }); return }
    setSel(i); setCalled({ heard, reply: `네, ${name} 침대예요` }); ding()
  }
  const wardSay = (command: Command) => {
    setCalled(null)
    if (boardUrl) { sendBoard({type:'text', text:command.heard}); return }
    apply(s => interpret(s, command.heard, command.output))
  }
  const pressBed = () => {
    if (boardUrl) { sendBoard({type:'button', bed: BED_NAMES[sel]}); return }
    if (moving || state.ringing) { apply(pressButton); return }
    apply(s => ({...s, speech:'', note:BED_NAMES[sel]+' 침대가 듣고 있어요.'}))
  }
  const setAngle = (part: Part, value: number) => {
    const angle = Math.min(LIMIT[part],Math.max(0,value))
    if (boardUrl) {
      // 11/17: 말로 바꾸지 않고 폰 앱과 같은 각도 요청(bed-move)을 보낸다. 숫자·막대는 바로 목표로, 침대는 따라간다
      const next = { ...state.target, [part]: angle }
      holdUntil.current[sel] = performance.now() + 2000
      apply(s=>({...s,target:next}))
      const go = () => { sendLater.current = null; sendAt.current = performance.now(); sendBoard({ type: 'req', id: ++reqId.current, name: 'bed-move', body: { head: next.head, leg: next.leg } }) }
      if (sendLater.current !== null) clearTimeout(sendLater.current)
      if (performance.now() - sendAt.current > 150) go(); else sendLater.current = window.setTimeout(go, 150)
      return
    }
    stopHold()
    apply(s=>({...s,target:{...s.target,[part]:angle},purpose:null,pending:null,after:''}))
  }
  const stop = () => {
    if(boardUrl){sendBoard({type:'button', bed: BED_NAMES[sel]});return}
    stopHold()
    if(moving || state.ringing) apply(pressButton)
  }
  return <>
    <main className="stage"><Ward3D beds={beds.map(b=>b.state.angles)} ringing={anyRing} ringBeds={ringBeds} view={view} tick={viewTick}/></main>
    <div className="brand"><h1>잘자요</h1><p>편안함이 움직이는 공간</p></div>
    <section className="remote" aria-label="침대 조작판">
      <nav className="rail" aria-label="조작 메뉴"><span className="remote-mark"><img src="./fig-moon.svg?v=4" alt="잘자요" width="16" height="28" style={{display:"block"}} /></span>{TABS.map(t=><button key={t.key} aria-selected={tab===t.key} onClick={()=>setTab(t.key)}>{t.label}</button>)}<button className="stop" onClick={stop}>■ 멈춤</button></nav>
      <div className="console">
        <div className="console-top"><span className="title">침대 부르기 · 지금 {101+sel}호 {BED_NAMES[sel]}</span><span id="motion-status">{state.ringing?'알람':shownMoving?'움직이는 중':'멈춤'}</span></div>
        <div className="call-names" aria-label="침대 부르기">{[...BED_NAMES,'수박'].map((n,i)=><button key={n} aria-pressed={i<3&&sel===i} title={i<3?`${101+i}호`:'이 병실에 없는 이름'} onClick={()=>callName(`${n} 침대`)}>{n} 침대</button>)}</div>
        {tab==='pose' && <div className="pane"><h2>각도 조절</h2><div className="sliders">{(['head','leg'] as const).map(part=>{
          const name=part==='head'?'머리':'다리',value=Math.round(state.target[part])
          return <div className="sliderline" key={part}><label htmlFor={part}>{name}</label><button aria-label={name+' 내리기'} onClick={()=>setAngle(part,state.target[part]-5)}>−</button><input id={part} type="range" min="0" max={LIMIT[part]} step="any" value={state.target[part]} onPointerDown={()=>setBarDrag(part)} onPointerUp={()=>setBarDrag(null)} onPointerCancel={()=>setBarDrag(null)} onChange={e=>setAngle(part,Math.round(+e.target.value))}/><button aria-label={name+' 올리기'} onClick={()=>setAngle(part,state.target[part]+5)}>+</button><output>{value}°</output></div>
        })}</div><h2>저장 자세{poseMode && <span className="pose-mode-hint"> · {poseMode==='save'?'어느 자세에 저장할까요?':poseMode==='reserve'?'어느 자세로 예약할까요?':'어느 자세를 되돌릴까요?'}</span>}</h2><div className={'presets'+(poseMode?' picking':'')}>{PRESETS.map(p=>{
          const saved=state.memory[p.key], a=saved??DEFAULTS[p.key], label=p.key==='sleep'?'수면 · 평평하게':p.label
          const pick=()=>{setPoseMode(null);setCalled(null)
            if(poseMode==='reserve'){setReservePick(p.key);return}
            if(boardUrl){sendBoard({type:'text',text:`${p.label} 자세${poseMode==='save'?'로 저장':' 리셋해'}`});return}
            apply(s=>poseMode==='save'?savePose(s,p.key):resetPose(s,p.key))}
          return <button key={p.key} aria-pressed={reservePick===p.key} onClick={()=>poseMode?pick():boardUrl?sendBoard({type:'text',text:p.say}):apply(s=>interpret(s,p.say,callOutput(p.key)))}><b>{label}</b><small className={saved?'saved':''}>{saved?'저장 · ':''}머리 {a.head}° · 다리 {a.leg}°</small></button>})}</div>
          <div className="pose-tools"><button aria-pressed={poseMode==='save'} onClick={()=>setPoseMode(m=>m==='save'?null:'save')}>지금 각도로 저장</button><button aria-pressed={poseMode==='reset'} onClick={()=>setPoseMode(m=>m==='reset'?null:'reset')}>처음 값으로 되돌리기</button><button className="wide" aria-pressed={poseMode==='reserve'||!!reservePick} onClick={()=>{setReservePick(null);setPoseMode(m=>m==='reserve'?null:'reserve')}}>자세 예약</button></div>
          {reservePick && <div className="reserve-times" role="group" aria-label="예약 시각"><span>{RESERVE_NAME[reservePick]} 예약 · 언제?</span>{RESERVE_TIMES.map(t=><button key={t.time} onClick={()=>{wardSay(reserveCommand(reservePick,t));setReservePick(null)}}>{t.label}</button>)}<button className="ghost" onClick={()=>setReservePick(null)}>닫기</button></div>}
          {state.reservation && <div className="reserve-line"><span>예약 · {RESERVE_NAME[state.reservation.purpose]} · {state.reservation.label}</span><button onClick={()=>wardSay(CANCEL_RESERVE)}>취소</button></div>}</div>}
        {tab==='talk' && <div className="pane" id="talk-pane"><div id="talk-items" aria-label="선택한 병상에 보낼 명령">
          
          <section className="scenes"><h2>대표 장면 · {101+sel} {BED_NAMES[sel]}</h2>{WARD_SCENES[sel].map((c,i)=><button key={c.heard} className="scene" onClick={()=>wardSay(c)}><span className="scene-no">{i+1}</span><span className="scene-text"><small>{c.group}{c.hint?' · '+c.hint:''}</small>{c.heard}</span></button>)}</section>
          <details className="more"><summary>예시 더 보기</summary>{WARD_GROUPS.map(group=><section key={group.title}><h2>{group.title}</h2>{group.items.map(c=><button key={c.heard} onClick={()=>wardSay(c)}>{c.heard}</button>)}</section>)}</details>
        </div></div>}
        {tab==='device' && <div className="pane"><div className="device-actions"><button onClick={pressBed}>침대 버튼</button><button disabled={!state.reservation} onClick={()=>{setCalled(null);if(boardUrl){sendBoard({type:'demo',action:'reservation-now',bed:BED_NAMES[sel]});return};apply(reservationDue)}}>예약 시각이 됨</button><button disabled={state.ringing||(!!boardUrl&&!state.alarm)} onClick={()=>{setCalled(null);if(boardUrl){sendBoard({type:'demo',action:'alarm-now',bed:BED_NAMES[sel]});return};apply(alarmDue)}}>알람 시각이 됨</button><button disabled={!state.ringing} onClick={()=>{setCalled(null);if(boardUrl){sendBoard({type:'button',bed:BED_NAMES[sel],long:true});return};apply(alarmOff)}}>알람 끄기</button></div>
          <details className="more"><summary>상세 설정</summary><div className="device-actions"><button onClick={()=>{sensorOn.current[sel]=true;apply(toggleOccupied)}}>{state.occupied?'침대에서 나가기':'침대에 눕기'}</button><label><input type="checkbox" checked={hum} onChange={()=>setHum(!hum)}/>모터 소리</label><label><input type="checkbox" checked={state.liftAllowed} onChange={()=>apply(s=>({...s,liftAllowed:!s.liftAllowed}))}/>알람 때 상체 올림</label>{boardUrl&&<label><input type="checkbox" checked={always} onChange={()=>{sendBoard({type:'always',on:!always});setAlways(!always)}}/>{boardInfo} · 침대 접속 {BED_NAMES.map((n,i)=>`${n} ${linkedBeds[i]?'붙음':'끊김'}`).join(' · ')}</label>}</div></details></div>}
        <div className="feedback" aria-live="polite"><strong>{called ? `「${called.heard}」 → ${called.reply}` : (state.speech || state.note || '원하는 병상과 자세를 골라 주세요')}</strong>
          {state.pending?.kind==='confirm' && <div className="confirm-actions" role="group" aria-label="제안에 답하기">
            <button onClick={()=>wardSay({heard:'응',output:'<maum_2>(type=yes, value=none)<maum_end>'})}>예</button>
            <button onClick={()=>wardSay({heard:'아니',output:'<maum_2>(type=no, value=none)<maum_end>'})}>아니오</button>
          </div>}
        </div>
        <h2>카메라 시점</h2><nav className="views">{([['default','침대 정면'],['side','침대 옆'],['overview','입구'],['window','창가']] as const).map(([v,label])=><button key={v} aria-pressed={view===v} onClick={()=>{setView(v);setViewTick(t=>t+1)}}>{label}</button>)}</nav>
      </div>
    </section>
    {/* 말 → 출력 → 동작을 한 칸에 잇는다. 모델을 거치지 않은 턴은 '모델 호출 없음' */}
    <aside className="model-panel trace"><span className="title">방금 처리 · {101+sel} {BED_NAMES[sel]}</span>
      <div className="trace-row"><span>말</span><b>{called ? `「${called.heard}」` : state.heard ? `「${state.heard}」` : '아직 없음'}</b></div>
      <div className="trace-row"><span>출력</span><code>{called ? '모델 호출 없음 · 이름은 보드가 소리로 찾아요' : (state.output || '없음')}</code></div>
      {!called && state.ranPrev && <div className="trace-row"><span>실행</span><code>동의 → 앞 요청 {state.ranPrev}</code></div>}
      <div className="trace-row"><span>동작</span><b>{called ? called.reply : (state.speech || (shownMoving ? '움직이는 중' : state.note) || '없음')}</b></div>
    </aside>
  </>
}
