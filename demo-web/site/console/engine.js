// 모델 출력(<maum_N>(...)<maum_end>)을 읽어 침대 상태를 바꾼다. 규칙과 안내 문장은 docs/system-design.md와 7차 행동·대답 표를 따른다
// 움직임 대답은 움직이기 전에 말하지 않고, 다 움직인 뒤 결과만 말한다(after). 바람·불평(confirm=yes)은 먼저 묻고 "응"을 기다린다(pending)

                                                                        
                                 
                                                  

                                                                                           
                                                                               

                        
                                           
                          
                                                         
                         
                       
                               
                                                          
                                                           
                                   
                                             
                                 
                     
                  
                                                                                  
                               
                            
                                         
                           
                         
 

export const LIMIT         = { head: 60, leg: 40 }
// 목적별 시제품 초기값(설계서 1절)
export const DEFAULTS                          = {
  read: { head: 45, leg: 15 },
  tv: { head: 30, leg: 10 },
  rest: { head: 15, leg: 20 },
  sleep: { head: 0, leg: 0 },
  base: { head: 20, leg: 10 },
  flat: { head: 0, leg: 0 },
}
export const PURPOSE_NAME                          = { read: '독서', tv: 'TV', rest: '휴식', sleep: '잠', base: '기본', flat: '평평하게' }
const PART_NAME                       = { head: '머리', leg: '다리' }
const ALARM_NAME                                = { basic: '기본', leave_bed: '침대에서 나와야 꺼지는', question: '질문' }

export const initialState           = {
  angles: { head: 0, leg: 0 },
  target: { head: 0, leg: 0 },
  moveStart: { head: 0, leg: 0 },
  purpose: null,
  lastPart: null,
  lastDir: null,
  undo: null,
  memory: {},
  occupied: true,
  liftAllowed: false,
  reservation: null,
  alarm: null,
  ringing: false,
  pending: null,
  after: '',
  speech: '',
  note: '아래에서 사용자가 하는 말을 고르면, 모델이 낸 출력대로 침대가 움직여요.',
  heard: '',
  output: '',
}

const clamp = (v        , part      ) => Math.max(0, Math.min(LIMIT[part], v))
const MOVING_NOTE = '움직이는 중이에요. 다 움직인 뒤 결과를 말해요.'

// 숫자를 읽는 말로(분은 한자어, 시는 고유어)
const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const sino = (n        ) => n === 0 ? '영' : (n >= 10 ? (Math.floor(n / 10) > 1 ? SINO[Math.floor(n / 10)] : '') + '십' : '') + SINO[n % 10]
const NATIVE = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두']
const duration = (mins        ) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return [h ? `${NATIVE[h]} 시간` : '', m ? `${sino(m)} 분` : ''].filter(Boolean).join(' ')
}
const clock = (hhmm        ) => {
  const [h, m] = hhmm.split(':').map(Number)
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${NATIVE[hh]} 시${m ? ` ${sino(m)} 분` : ''}`
}

export function parse(out        )                                                                         {
  const m = out.match(/^<(maum_[0-4]|General_Conversation)>\((.*)\)<maum_end>$/)
  if (!m) return null
  const kv                         = {}
  if (m[2]) for (const p of m[2].split(', ')) { const [k, v] = p.split('='); kv[k] = v }
  const cmd = kv.command ?? null
  delete kv.command
  return { tok: m[1], cmd, kv }
}

// 움직임 시작: 결과는 다 움직인 뒤 after로 말한다
function moveTo(s          , target        , purpose                , after        )           {
  const same = target.head === s.target.head && target.leg === s.target.leg
  if (same) return { ...s, purpose, speech: after, after: '' }
  return { ...s, undo: { target: s.target, purpose: s.purpose }, moveStart: s.angles, target, purpose, after, speech: '', note: MOVING_NOTE }
}

// "~했어요"로 끝나는 결과 문장을 "~할까요?"로 바꿔 먼저 묻는다
const ASK                     = [['맞췄어요', '맞출까요?'], ['올렸어요', '올릴까요?'], ['내렸어요', '내릴까요?'], ['바꿨어요', '바꿀까요?'],
  ['예약했어요', '예약할까요?'], ['저장했어요', '저장할까요?'], ['되돌렸어요', '되돌릴까요?'], ['돌아갔어요', '돌아갈까요?'], ['취소했어요', '취소할까요?']]
function toQuestion(result        ) {
  for (const [a, b] of ASK) if (result.endsWith(a)) return result.slice(0, -a.length) + b
  return result
}

// 사용자 말과 모델 출력 하나를 받아 다음 상태를 만든다
export function interpret(s0          , heard        , out        )           {
  const s           = { ...s0, heard, output: out, speech: '', note: '', ranPrev: '' }
  const p = parse(out)
  if (!p) return { ...s, speech: '다시 한 번 말씀해 주세요', note: '출력 형식이 깨져서 움직이지 않아요.' }
  const { tok, cmd, kv } = p

  // 바람·불평: 실행하지 않고 결과 문장을 질문으로 바꿔 먼저 묻는다. "응"을 들으면 같은 일을 실행한다
  if (kv.confirm === 'yes') {
    const direct = out.replace('confirm=yes', 'confirm=no')
    const dry = interpret(s0, heard, direct)
    if (dry.pending) return { ...dry, output: out } // 부위가 빠졌으면 그 질문이 먼저
    const result = dry.after || (/(예약했어요|저장했어요|되돌렸어요)$/.test(dry.speech) ? dry.speech : '')
    if (!result) return { ...dry, output: out }
    return { ...s, pending: { kind: 'confirm', output: direct }, speech: toQuestion(result), note: '"응"이라고 하면 움직여요. 대답이 없으면 10초 뒤 그만둬요.' }
  }

  if (tok === 'maum_0' && cmd === 'call') {
    const pur = kv.purpose           
    const mem = s.memory[pur]
    return { ...moveTo(s, mem ?? DEFAULTS[pur], pur, `${mem ? '저장한' : ''} ${PURPOSE_NAME[pur]} 자세로 바꿨어요`.trim()), pending: null }
  }

  // 자세 저장("티비 자세로 저장")과 저장 지우기("티비 자세 리셋해")
  if (tok === 'maum_0' && cmd === 'set_default') {
    const pur = (SAVABLE.includes(kv.purpose) ? kv.purpose : s.purpose)
    if (!pur || !SAVABLE.includes(pur)) return { ...s, speech: '어느 자세로 저장할까요?', pending: null }
    return savePose(s, pur)
  }
  if (tok === 'maum_0' && cmd === 'reset_default') {
    if (kv.purpose === 'all') return resetPose(s, 'all')
    if (!SAVABLE.includes(kv.purpose)) return { ...s, speech: '어느 자세를 되돌릴까요?', pending: null }
    return resetPose(s, kv.purpose)
  }

  // 머리·다리 두 각도를 한 번에("삼십 이십 해줘")
  if (tok === 'maum_0' && cmd === 'set_angles') {
    const target = { head: clamp(Number(kv.head), 'head'), leg: clamp(Number(kv.leg), 'leg') }
    return remember({ ...moveTo(s, target, s.purpose, `머리 ${target.head}도, 다리 ${target.leg}도로 맞췄어요`), pending: null })
  }

  if (tok === 'maum_0' && cmd === 'adjust') {
    const amount = kv.amount
    const type = kv.amount_type
    if (kv.part === 'both') {
      if (type === 'target' && amount === '0') return { ...moveTo(s, { head: 0, leg: 0 }, s.purpose, '평평하게 맞췄어요'), pending: null }
    }
    if (kv.part === 'both') {
      const target = { ...s.target };
      for (const part of ['head', 'leg']) {
        if (type === 'target') target[part] = amount === 'max' ? (kv.direction === 'down' ? 0 : LIMIT[part]) : clamp(Number(amount), part);
        else {
          const step = amount === 'small' ? 5 : amount && amount !== 'none' ? Number(amount) : kv.direction === 'down' ? target[part] : 10;
          target[part] = clamp(target[part] + (kv.direction === 'down' ? -step : step), part);
        }
      }
      return remember({ ...moveTo(s, target, s.purpose, `머리 ${target.head}도, 다리 ${target.leg}도로 맞췄어요`), pending: null });
    }
    const part              = kv.part === 'leg' || kv.part === 'head' ? kv.part : s.lastPart
    if (!part) return { ...s, pending: { kind: 'part', output: out }, speech: '어느 쪽을 맞출까요? 머리, 다리 중에 말해 주세요' }
    const dir = kv.direction === 'same' ? s.lastDir : (kv.direction                          )
    const name = PART_NAME[part]
    const cur = s.target[part]
    let to = cur
    let result = ''
    if (type === 'target' && amount === 'max') {
      to = dir === 'down' ? 0 : LIMIT[part]
      result = dir === 'down' ? `${name}를 끝까지 내렸어요` : `${name}를 최대인 ${LIMIT[part]}도까지 올렸어요`
    } else if (type === 'target') {
      const want = Number(amount)
      to = clamp(want, part)
      result = to === want ? `${name}를 ${to}도로 맞췄어요` : `${name}를 최대인 ${to}도까지 올렸어요`
    } else {
      if (dir !== 'up' && dir !== 'down') return { ...s, speech: `${name} 올릴까요, 내릴까요?` }
      // 양을 말하지 않으면 올리기 10도, 내리기는 끝(0도). "조금"·"덜"은 5도
      const step = amount === 'small' ? 5 : amount && amount !== 'none' ? Number(amount) : dir === 'up' ? 10 : cur
      const want = cur + (dir === 'up' ? step : -step)
      to = clamp(want, part)
      if (to === cur) return { ...s, speech: dir === 'up' ? `${name}는 이미 최대인 ${LIMIT[part]}도예요` : `${name}는 이미 가장 낮아요`, lastPart: part, lastDir: dir, pending: null }
      result = to !== want && dir === 'up' ? `${name}를 최대인 ${to}도까지 올렸어요` : `${name}를 ${Math.abs(to - cur)}도 ${dir === 'up' ? '올렸어요' : '내렸어요'}`
    }
    const next = moveTo(s, { ...s.target, [part]: to }, s.purpose, result)
    return remember({ ...next, lastPart: part, lastDir: to >= cur ? 'up' : 'down', pending: null })
  }

  if (tok === 'maum_0' && cmd === 'undo') {
    if (!s.undo) return { ...s, speech: '지금은 할 수 없는 요청이에요', pending: null }
    const back = moveTo(s, s.undo.target, s.undo.purpose, '조절하기 전 자세로 돌아갔어요')
    return { ...back, undo: null, pending: null }
  }

  if (tok === 'maum_0' && cmd === 'reserve') {
    const pur = (kv.purpose === 'none' ? 'sleep' : kv.purpose)           
    const [h, m] = (kv.time ?? '00:30').split(':').map(Number)
    const mins = h * 60 + m
    const label = kv.time_type === 'relative' ? `${duration(mins)} 뒤` : clock(kv.time)
    const target = s.memory[pur] ?? DEFAULTS[pur] // 예약할 때 목표 각도를 정해 저장한다
    const what = pur === 'flat' ? '평평하게' : `${PURPOSE_NAME[pur]} 자세로`
    return { ...s, pending: null, reservation: { label, mins, purpose: pur, target }, speech: `${label}에 ${what} 바꾸도록 예약했어요` }
  }

  if (tok === 'maum_0' && cmd === 'change_reserve') {
    if (!s.reservation) return { ...s, speech: '걸려 있는 자세 예약이 없어요', pending: null }
    const r = s.reservation
    const name = r.purpose === 'flat' ? '평평하게 바꾸는' : `${PURPOSE_NAME[r.purpose]} 자세`
    if (!kv.time || kv.time === 'none') return { ...s, speech: `${name} 예약을 얼마나 ${kv.time_type === 'earlier' ? '앞당길까요' : '늦출까요'}?` }
    const [h, m] = kv.time.split(':').map(Number)
    const d = (kv.time_type === 'earlier' ? -1 : 1) * (h * 60 + m)
    const mins = Math.max(1, r.mins + d)
    return { ...s, pending: null, reservation: { ...r, mins, label: `${duration(mins)} 뒤` }, speech: `${name} 예약을 ${duration(h * 60 + m)} ${d < 0 ? '앞당겼어요' : '늦췄어요'}` }
  }

  if (tok === 'maum_0' && cmd === 'cancel_reserve') {
    if (!s.reservation) return { ...s, speech: '걸려 있는 자세 예약이 없어요', pending: null }
    const r = s.reservation
    return { ...s, pending: null, reservation: null, speech: `${r.label} ${r.purpose === 'flat' ? '평평하게 바꾸는' : PURPOSE_NAME[r.purpose] + ' 자세'} 예약을 취소했어요` }
  }

  if (tok === 'maum_1' && cmd === 'set') {
    if (!kv.time || kv.time === 'none') return { ...s, speech: '몇 시에 맞출까요?' }
    const day = ({ today: '오늘', tomorrow: '내일', '+2': '모레' }                          )[kv.date] ?? ''
    const ampm = kv.ampm === 'am' ? '오전' : kv.ampm === 'pm' ? '오후' : ''
    const alarm        = { day, ampm, time: kv.time, label: [day, ampm, clock(kv.time)].filter(Boolean).join(' '), type: (kv.type === 'none' ? 'basic' : kv.type)                  }
    return { ...s, pending: null, alarm, speech: `${alarm.label}, ${ALARM_NAME[alarm.type]} 알람으로 맞췄어요` }
  }

  // 방금 맞춘 알람의 시각만 고친다(같은 알람 한 줄, 개수는 그대로)
  if (tok === 'maum_1' && cmd === 'change_time') {
    if (!s.alarm) return { ...s, pending: null, speech: '바꿀 알람이 없어요' }
    if (!kv.time || kv.time === 'none') return { ...s, speech: '몇 시로 바꿀까요?' }
    const old = s.alarm
    const day = ({ today: '오늘', tomorrow: '내일', '+2': '모레' })[kv.date] ?? old.day ?? ''
    const ampm = kv.ampm === 'am' ? '오전' : kv.ampm === 'pm' ? '오후' : (old.ampm ?? '')
    const alarm = { ...old, day, ampm, time: kv.time, label: [day, ampm, clock(kv.time)].filter(Boolean).join(' ') }
    const c = alarm.label.charCodeAt(alarm.label.length - 1) - 0xac00, jong = c >= 0 && c < 11172 ? c % 28 : 0 // 받침 있으면 '으로'(ㄹ 받침은 '로')
    return { ...s, pending: null, alarm, speech: `${old.label} 알람을 ${alarm.label}${jong && jong !== 8 ? '으로' : '로'} 바꿨어요` }
  }

  if (tok === 'maum_2' && kv.type === 'yes') {
    if (!s.pending || s.pending.kind !== 'confirm') return { ...s, note: '물어본 것이 없어서 대답하지 않아요.' }
    // 화면에는 '응 → 동의'와 '앞 요청 실행'을 따로 보인다. 출력 칸이 앞 명령으로 바뀌지 않게 한다
    return { ...interpret({ ...s0, pending: null }, heard, s.pending.output), output: out, ranPrev: s.pending.output }
  }
  if (tok === 'maum_2' && kv.type === 'no') {
    if (!s.pending) return { ...s, note: '물어본 것이 없어서 대답하지 않아요.' }
    return { ...s, pending: null, note: '물어보던 것을 끝내고 대답하지 않아요.' }
  }
  if (tok === 'maum_2' && kv.type === 'part') {
    const name = kv.value === 'leg' ? '다리' : '머리'
    if (!s.pending || s.pending.kind !== 'part') return { ...s, speech: `${name} 올릴까요, 내릴까요?` }
    return interpret({ ...s0, pending: null }, heard, s.pending.output.replace('part=none', `part=${kv.value}`))
  }
  if (tok === 'maum_2' && kv.type === 'reference') {
    const moving = s.angles.head !== s.target.head || s.angles.leg !== s.target.leg
    if (moving) return stopNow(s, '움직이지 말라는 말을 듣고 그 자리에서 멈췄어요.')
    if (s.pending) return { ...s, pending: null, note: '물어보던 제안을 접고 그대로 둬요.' }
    return { ...s, note: '움직이는 중이 아니라서 할 일이 없어요.' }
  }

  if (tok === 'maum_3') {
    return { ...s, pending: null, speech: kv.reason === 'app_only' ? '그건 스마트폰 잘자요 앱에서 설정할 수 있어요' : '지금 하신 요청은 제가 할 수 없는 일이에요' }
  }

  if (tok === 'General_Conversation') {
    return { ...s, note: '할 일이 없는 말이라 대답하지 않아요.' }
  }

  return { ...s, speech: '지금은 할 수 없는 요청이에요' }
}

// 목적 자세를 쓰는 중에 조절했으면 그 목적의 마지막 각도로 기억한다
// 저장은 「지금 각도로 저장」 버튼이나 "티비 자세로 저장" 같은 말로만 한다(각도를 고쳐도 자동으로 바뀌지 않음)
function remember(s) { return s }

const SAVABLE = ['read', 'tv', 'rest', 'sleep']
const angleText = (a) => `머리 ${a.head}도, 다리 ${a.leg}도`
// 지금 각도를 그 자세의 저장 값으로 둔다
export function savePose(s, pur) {
  const a = { head: Math.round(s.target.head), leg: Math.round(s.target.leg) }
  return { ...s, memory: { ...s.memory, [pur]: a }, purpose: pur, pending: null, speech: `지금 각도(${angleText(a)})를 ${PURPOSE_NAME[pur]} 자세로 저장했어요`, note: '' }
}
// 저장 값을 지우고 처음 값으로 되돌린다. 'all'은 네 자세 모두
export function resetPose(s, pur) {
  if (pur === 'all') return { ...s, memory: {}, pending: null, speech: '저장한 자세를 모두 처음 값으로 되돌렸어요', note: '' }
  const memory = { ...s.memory }; delete memory[pur]
  return { ...s, memory, pending: null, speech: `${PURPOSE_NAME[pur]} 자세를 처음 값(${angleText(DEFAULTS[pur])})으로 되돌렸어요`, note: '' }
}

// 움직이다 멈추면 실제로 간 각도를 말한다
function stopNow(s          , note        )           {
  const a = { head: Math.round(s.angles.head), leg: Math.round(s.angles.leg) }
  const moved = (['head', 'leg']          ).filter((p) => Math.round(s.moveStart[p]) !== a[p])
  let speech = '멈췄어요'
  if (moved.length === 1) {
    const p = moved[0]
    speech = `${PART_NAME[p]}를 ${a[p]}도까지 ${a[p] > s.moveStart[p] ? '올리고' : '내리고'} 멈췄어요`
  } else if (moved.length === 2) speech = `머리 ${a.head}도, 다리 ${a.leg}도에서 멈췄어요`
  return { ...s, target: s.angles, after: '', pending: null, speech, note }
}

// 물리 버튼: 움직임과 알람 소리를 바로 멈춘다(모델을 거치지 않음)
export function pressButton(s          )           {
  const moving = s.angles.head !== s.target.head || s.angles.leg !== s.target.leg
  if (s.ringing) return { ...s, ringing: false, alarm: null, target: s.angles, after: '', speech: '좋은 아침이에요 알람을 끌게요', note: '버튼으로 알람을 껐어요.', heard: '', output: '' }
  if (moving) return { ...stopNow(s, '버튼은 모델을 거치지 않고 바로 멈춰요.'), heard: '', output: '' }
  return { ...s, note: '움직이는 중이 아니라서 할 일이 없어요.', speech: '', heard: '', output: '' }
}

export function toggleOccupied(s          )           {
  const occupied = !s.occupied
  if (!occupied && s.ringing) return { ...s, occupied, ringing: false, alarm: null, target: s.angles, speech: '좋은 아침이에요 알람을 끌게요', note: '침대에서 나와서 알람이 꺼졌어요.', heard: '', output: '' }
  return { ...s, occupied, speech: '', note: occupied ? '센서가 눌렸어요. 누워 있는 것으로 봐요.' : '센서가 비었어요. 침대에서 나온 것으로 봐요.', heard: '', output: '' }
}

export function reservationDue(s          )           {
  const base = { ...s, heard: '', output: '', speech: '' }
  if (!s.reservation) return { ...base, note: '걸려 있는 자세 예약이 없어요.' }
  if (s.ringing) return { ...base, reservation: null, note: '알람이 울리는 중이라 예약을 실행하지 않고 실행하지 못했다고 남겨요.' }
  const r = s.reservation
  const what = r.purpose === 'flat' ? '평평하게' : `${PURPOSE_NAME[r.purpose]} 자세로`
  return { ...base, reservation: null, undo: { target: s.target, purpose: s.purpose }, moveStart: s.angles, target: r.target, purpose: r.purpose, after: '', note: `예약 시각이 되어 ${what} 바꿔요.` }
}

export function alarmDue(s          )           {
  const base = { ...s, heard: '', output: '', speech: '', pending: null }
  // 맞춘 알람이 없어도 시연용 알람을 하나 울린다
  if (!s.alarm) base.alarm = { label: '시연용 알람', type: 'basic' }
  // 상체 올림은 허용했고 누워 있을 때만, 머리 30도보다 낮을 때만 올린다
  if (s.liftAllowed && s.occupied && s.target.head < 30) {
    return { ...base, ringing: true, moveStart: s.angles, target: { ...s.target, head: 30 }, purpose: null, after: '', note: '알람이 울려요. 상체를 머리 30도까지 올려요.' }
  }
  return { ...base, ringing: true, note: s.occupied ? '알람이 울려요. 소리만 울려요.' : '침대가 비어 있어도 기본 알람은 울려요.' }
}

// 알람 끄기 버튼: 울리는 동안만 쓴다. 침대 버튼으로 끌 때와 같은 대답
export function alarmOff(s) {
  if (!s.ringing) return { ...s, note: '울리는 알람이 없어요.', speech: '', heard: '', output: '' }
  return { ...s, ringing: false, alarm: null, target: s.angles, after: '', pending: null, speech: '좋은 아침이에요 알람을 끌게요', note: '알람 끄기 버튼으로 껐어요.', heard: '', output: '' }
}
