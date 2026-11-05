import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { ExpandRow } from '@/components/ExpandRow'
import { ObScreen, obStyles } from '@/components/ObScreen'
import { Switch } from '@/components/Switch'
import { TimeWheels } from '@/components/TimeWheels'
import { clockLabel } from '@/features/alarm/alarm'
import { useInnerBack } from '@/features/app/flow'
import { type NightTime, setBedInfo, useBedInfo, wardDefault } from '@/features/bed/bed'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { CONTACT, MY_BED, ROOMS, getHospital, setHospital, useHospital, usedNames } from '@/features/hospital/hospital'
import { color, font } from '@/theme/tokens'

import { FruitGrid } from './NamePick'

const digits6 = (t: string) => t.replace(/\D/g, '').slice(0, 6)
const nightSummary = (n: NightTime) =>
  n.on ? `${clockLabel(n.from)}부터 다음 날 ${clockLabel(n.to)}까지 꺼져요` : '밤에도 이름을 부르면 대답해요'

// 병원 관리 들어가기: 납품 때 병원마다 다르게 넣어 보낸 관리 비밀번호(숫자 6자리)
export function AdminPassword({ onIn, onOut }: { onIn: () => void; onOut: () => void }) {
  const [pw, setPw] = useState('')
  const [bad, setBad] = useState(false)
  const [help, setHelp] = useState(false)
  const r = useBedRequest()
  useInnerBack(() => r.waiting && !r.timedOut)
  const go = () => {
    if (pw.length !== 6 || r.waiting) return
    if (r.timedOut) return r.retry()
    r.send({ type: 'admin-login', body: { password: pw } }, (reply) => {
      if (reply.ok === false) return setBad(true)
      setHospital({ message: '' })
      onIn()
    })
  }
  return (
    <ObScreen
      title="병원 관리"
      lead="병원 직원인지 확인할게요. 납품 때 받은 관리 비밀번호를 넣어 주세요."
      primary={{ label: r.waiting && !r.timedOut ? '확인 중…' : r.timedOut ? '다시 시도' : '확인', onPress: go, disabled: pw.length !== 6 || (r.waiting && !r.timedOut) }}
      secondary={{ label: '취소', onPress: () => { r.cancel(); onOut() } }}
      links={[{ label: '비밀번호를 잊었어요', onPress: () => setHelp((h) => !h) }]}
    >
      <Text style={obStyles.label}>관리 비밀번호 (숫자 6자리)</Text>
      <TextInput
        style={[obStyles.input, bad && obStyles.inputBad]}
        value={pw}
        onChangeText={(t) => { setPw(digits6(t)); setBad(false) }}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel="관리 비밀번호"
        onSubmitEditing={go}
      />
      {bad && <Text style={obStyles.err} role="alert">비밀번호가 맞지 않아요. 다시 넣어 주세요.</Text>}
      {r.timedOut && <Text style={obStyles.noteBad}>침대와 연결이 잠시 끊겼어요. 다시 시도해 주세요.</Text>}
      {help && (
        <Text style={obStyles.note}>
          {`잘자요 설치 담당자에게 연락해 주세요. 병원 담당자인지 확인한 뒤 새 비밀번호를 정해 드려요.\n문의: ${CONTACT}`}
        </Text>
      )}
    </ObScreen>
  )
}

// 병원 설정: 밤 시간과 알람 쓰기를 정해 등록된 병원 침대 전체에 보낸다. 답한 침대만 적용으로 센다
export function AdminHome({ onBeds, onPassword, onOut }: { onBeds: () => void; onPassword: () => void; onOut: () => void }) {
  const bed = useBedInfo()
  const hosp = useHospital()
  const saved = bed.ward ?? wardDefault()
  const [night, setNight] = useState<NightTime>(saved.night)
  const [alarm, setAlarm] = useState(saved.alarmAllowed)
  const [openT, setOpenT] = useState<'from' | 'to' | null>(null)
  const r = useBedRequest()
  const sending = r.waiting && !r.timedOut
  // 뒤로: 보내는 중이면 막고, 펼친 시간 바퀴가 있으면 그것만 닫는다
  useInnerBack(() => {
    if (sending) return true
    if (openT) {
      setOpenT(null)
      return true
    }
    return false
  })
  const same =
    alarm === saved.alarmAllowed && night.on === saved.night.on && night.from === saved.night.from && night.to === saved.night.to
  const retryOnly = same && hosp.unconfirmed.length > 0
  const total = hosp.beds.length

  const save = () => {
    if (sending || (same && !hosp.unconfirmed.length)) return
    if (r.timedOut) return r.retry()
    const targets = same ? hosp.unconfirmed : hosp.beds.map((b) => b.id)
    r.send({ type: 'admin-save', body: { night, alarm, beds: targets } }, (reply) => {
      // 답하지 않은 침대 번호를 침대(또는 병원 공유기)가 알려 준다
      const miss = Array.isArray(reply.missing) ? (reply.missing as number[]).filter((id) => targets.includes(id)) : []
      setBedInfo({ ward: { ...(bed.ward ?? wardDefault()), night: { ...night }, alarmAllowed: alarm } })
      const beds = getHospital().beds.map((b) => (targets.includes(b.id) ? { ...b, ok: !miss.includes(b.id) } : b))
      setHospital({
        beds,
        unconfirmed: miss,
        message: miss.length
          ? `등록된 ${total}대 중 ${total - miss.length}대 적용 · ${miss.length}대 확인 안 됨. 침대 전원과 와이파이를 확인하고 다시 보내 주세요.`
          : `등록된 ${total}대 모두 적용했어요.`,
      })
    })
  }

  return (
    <ObScreen
      title="병원 관리"
      lead={`잘자요 병원 · 등록된 침대 ${total}대. 저장하면 모든 침대에 보내요.`}
      primary={{
        label: sending ? '보내는 중…' : r.timedOut ? '다시 시도' : retryOnly ? `확인 안 된 ${hosp.unconfirmed.length}대에 다시 보내기` : '모든 침대에 저장',
        onPress: save,
        disabled: sending || (same && !hosp.unconfirmed.length && !r.timedOut),
      }}
      secondary={{ label: '나가기', onPress: onOut, disabled: sending }}
    >
      <Text style={obStyles.sec}>밤 시간</Text>
      <View style={[obStyles.card, obStyles.cardSmall]}>
        <View style={obStyles.switchRow}>
          <View style={styles.flex}>
            <Text style={obStyles.rowTitleBold}>밤에 이름 부르기 끄기</Text>
            <Text style={obStyles.rowSub}>꺼진 동안에도 침대 버튼을 누르면 말할 수 있어요</Text>
          </View>
          <Switch
            value={night.on}
            onValueChange={(on) => { setNight({ ...night, on }); if (!on) setOpenT(null) }}
            accessibilityLabel="밤에 이름 부르기 끄기"
            disabled={sending}
          />
        </View>
        {(['from', 'to'] as const).map((k) => (
          <View key={k} style={[obStyles.rowLine, !night.on && styles.dim]} pointerEvents={night.on && !sending ? 'auto' : 'none'}>
            <ExpandRow
              name={k === 'from' ? '시작' : '끝'}
              value={clockLabel(night[k])}
              open={openT === k}
              onPress={() => setOpenT(openT === k ? null : k)}
            >
              <TimeWheels value={night[k]} onChange={(v) => setNight((n) => ({ ...n, [k]: v }))} disabled={sending} />
            </ExpandRow>
          </View>
        ))}
      </View>
      <Text style={obStyles.sum}>{nightSummary(night)}</Text>

      <Text style={obStyles.sec}>알람</Text>
      <View style={[obStyles.card, obStyles.cardSmall]}>
        <View style={obStyles.switchRow}>
          <View style={styles.flex}>
            <Text style={obStyles.rowTitleBold}>알람 쓰기</Text>
            <Text style={obStyles.rowSub}>끄면 환자 앱과 침대 모두 알람을 만들거나 울리지 않아요. 예약은 소리 없이 자세만 바꿔 그대로 써요</Text>
          </View>
          <Switch value={alarm} onValueChange={setAlarm} accessibilityLabel="알람 쓰기" disabled={sending} />
        </View>
      </View>

      {!!hosp.message && !sending && (
        <Text style={hosp.unconfirmed.length ? obStyles.noteBad : obStyles.note} role="status">{hosp.message}</Text>
      )}
      {r.timedOut && <Text style={obStyles.noteBad}>보낸 결과를 확인하지 못했어요. 다시 시도해 주세요.</Text>}

      <View style={obStyles.card}>
        <Pressable style={obStyles.row} onPress={onBeds} disabled={sending}>
          <Text style={obStyles.rowTitle}>침대 목록</Text>
          <Text style={obStyles.chevron}>›</Text>
        </Pressable>
        <Pressable style={[obStyles.row, obStyles.rowLine]} onPress={onPassword} disabled={sending}>
          <Text style={obStyles.rowTitle}>관리 비밀번호 바꾸기</Text>
          <Text style={obStyles.chevron}>›</Text>
        </Pressable>
      </View>
    </ObScreen>
  )
}

// 침대 목록: 병실은 처음엔 모두 접혀 있고, 확인 안 된 침대가 있는 병실은 접힌 줄에 빨간 글씨로 보여 준다
export function AdminBeds({ onBed, onBack }: { onBed: (id: number) => void; onBack: () => void }) {
  const hosp = useHospital()
  const [open, setOpen] = useState<string[]>([])
  return (
    <ObScreen
      title="침대 목록"
      lead="호실을 누르면 침대가 펼쳐져요. 침대를 누르면 병실을 바꾸거나 환자 사용을 끝낼 수 있어요."
      secondary={{ label: '병원 관리로', onPress: onBack }}
    >
      {ROOMS.filter((r) => hosp.beds.some((b) => b.room === r)).map((room) => {
        const bs = hosp.beds.filter((b) => b.room === room)
        const bad = bs.filter((b) => !b.ok).length
        const isOpen = open.includes(room)
        return (
          <View key={room} style={[obStyles.card, obStyles.cardSmall]}>
            <Pressable
              style={styles.rhead}
              onPress={() => setOpen(isOpen ? open.filter((x) => x !== room) : [...open, room])}
              aria-expanded={isOpen}
            >
              <View style={styles.flex}>
                <Text style={obStyles.rowTitleBold}>{room}</Text>
                <Text style={obStyles.rowSub}>
                  {`침대 ${bs.length}대 · 환자 ${bs.filter((b) => b.phone).length}명`}
                  {bad ? <Text style={styles.red}>{` · ${bad}대 확인 안 됨`}</Text> : null}
                </Text>
              </View>
              <Text style={[obStyles.chevron, isOpen && styles.down]}>›</Text>
            </Pressable>
            {isOpen &&
              bs.map((b) => (
                <Pressable key={b.id} style={[obStyles.row, obStyles.rowLine]} onPress={() => onBed(b.id)}>
                  <View style={styles.flex}>
                    <Text style={obStyles.rowTitleBold}>{`${b.name} 침대`}</Text>
                    <Text style={[obStyles.rowSub, !b.ok && styles.red]}>
                      {`${b.phone ? '환자 폰 연결됨' : '환자 없음'} · ${b.ok ? '설정 적용됨' : '설정 확인 안 됨'}`}
                    </Text>
                  </View>
                  <Text style={obStyles.chevron}>›</Text>
                </Pressable>
              ))}
          </View>
        )
      })}
    </ObScreen>
  )
}

// 침대 하나: 병실 바꾸기(옮긴 병실에 같은 이름이 있으면 이름도 다시 고름), 환자 사용 종료
export function AdminBed({ onBack }: { onBack: () => void }) {
  const hosp = useHospital()
  const bed = useBedInfo()
  const b = hosp.beds.find((x) => x.id === hosp.bedId)
  const [room, setRoom] = useState(b?.room ?? '')
  const [name, setName] = useState(b?.name ?? '')
  const [roomOpen, setRoomOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const [ended, setEnded] = useState(false)
  const mv = useBedRequest()
  const end = useBedRequest()
  const busy = (mv.waiting && !mv.timedOut) || (end.waiting && !end.timedOut)
  // 뒤로: 옮기거나 끝내는 중이면 막고, 사용 종료 확인 줄·펼친 병실 목록이 있으면 그것만 닫는다
  useInnerBack(() => {
    if (busy) return true
    if (asking) {
      setAsking(false)
      return true
    }
    if (roomOpen) {
      setRoomOpen(false)
      return true
    }
    return false
  })
  if (!b) return null
  const used = usedNames(hosp.beds, room, b.id)
  const clash = room !== b.room && used.includes(b.name)
  const needName = clash && (!name || used.includes(name))

  const move = () => {
    if (busy || room === b.room || needName) return
    if (mv.timedOut) return mv.retry()
    mv.send({ type: 'admin-move', body: { bed: b.id, room, name } }, () => {
      setHospital({ beds: getHospital().beds.map((x) => (x.id === b.id ? { ...x, room, name } : x)) })
      if (b.id === MY_BED && bed.ward) setBedInfo({ ward: { ...bed.ward, name } })
      onBack()
    })
  }
  const finish = () => {
    if (busy) return
    if (end.timedOut) return end.retry()
    end.send({ type: 'admin-end', body: { bed: b.id } }, () => {
      setHospital({
        beds: getHospital().beds.map((x) => (x.id === b.id ? { ...x, phone: false } : x)),
        endedMine: getHospital().endedMine || b.id === MY_BED,
      })
      setAsking(false)
      setEnded(true)
    })
  }

  return (
    <ObScreen
      title={`${b.name} 침대`}
      lead={`${b.room} · ${b.phone ? '환자 폰 연결됨' : '환자 없음'}${ended ? ' · 사용을 끝냈어요' : ''}`}
      secondary={{ label: '침대 목록으로', onPress: onBack, disabled: busy }}
    >
      <Text style={obStyles.sec}>병실</Text>
      <View style={obStyles.card}>
        <ExpandRow
          name="병실"
          value={room === b.room ? room : `${b.room} → ${room}`}
          open={roomOpen}
          onPress={() => !busy && setRoomOpen(!roomOpen)}
        >
          <View style={styles.rooms} role="radiogroup" accessibilityLabel="병실">
            {ROOMS.map((r) => (
              <Pressable
                key={r}
                style={[styles.roomBtn, r === room && styles.roomOn]}
                onPress={() => {
                  setRoom(r)
                  setRoomOpen(false)
                  setName(r !== b.room && usedNames(hosp.beds, r, b.id).includes(b.name) ? '' : b.name)
                }}
                role="radio"
                aria-checked={r === room}
              >
                <Text style={[styles.roomText, r === room && styles.roomTextOn]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </ExpandRow>
      </View>
      {clash && (
        <>
          <Text style={obStyles.note}>{`${room}에 이미 '${b.name} 침대'가 있어요. 옮길 병실에서 쓸 이름을 골라 주세요.`}</Text>
          <FruitGrid label="새 부르는 이름" value={name} used={used} disabled={busy} onPick={setName} />
        </>
      )}
      <Pressable
        style={[styles.btn, (busy || room === b.room || needName) && !mv.timedOut && styles.dim]}
        onPress={move}
        disabled={(busy || room === b.room || needName) && !mv.timedOut}
      >
        <Text style={styles.btnText}>
          {mv.waiting && !mv.timedOut
            ? '옮기는 중…'
            : mv.timedOut
              ? '다시 시도'
              : room === b.room
                ? '옮길 병실을 골라 주세요'
                : needName
                  ? '이름을 골라 주세요'
                  : `${room}로 옮기기${name !== b.name ? ` · ${name} 침대로` : ''}`}
        </Text>
      </Pressable>

      <Text style={obStyles.sec}>환자 사용</Text>
      <Text style={obStyles.note}>
        사용을 끝내면 이 침대의 알람, 예약, 자세 기록을 지우고 환자 폰 연결을 끊어요. 이름, 병실, 병원 설정은 그대로예요. 다음 환자는 침대 QR을 찍어 바로 등록할 수 있어요.
      </Text>
      {!asking ? (
        <Pressable style={[styles.btnLight, (busy || !b.phone) && styles.dim]} onPress={() => setAsking(true)} disabled={busy || !b.phone}>
          <Text style={styles.btnLightWarn}>{b.phone ? '환자 사용 종료' : '연결된 환자 폰이 없어요'}</Text>
        </Pressable>
      ) : (
        <View style={styles.pair}>
          <Pressable style={[styles.btn, styles.btnWarn, styles.flex]} onPress={finish} disabled={busy}>
            <Text style={styles.btnText}>{end.waiting && !end.timedOut ? '끝내는 중…' : end.timedOut ? '다시 시도' : '사용 종료'}</Text>
          </Pressable>
          <Pressable style={[styles.btnLight, styles.flex]} onPress={() => { end.cancel(); setAsking(false) }} disabled={busy}>
            <Text style={styles.btnLightText}>취소</Text>
          </Pressable>
        </View>
      )}
    </ObScreen>
  )
}

// 관리 비밀번호 바꾸기: 퇴사자가 계속 들어오지 않게. 바꾸면 다른 직원 폰도 새 비밀번호로 다시 들어온다
export function AdminPasswordChange({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [diff, setDiff] = useState(false)
  const r = useBedRequest()
  const busy = r.waiting && !r.timedOut
  useInnerBack(() => busy)
  const ok = () => {
    if (p1.length !== 6 || p2.length !== 6 || busy) return
    if (p1 !== p2) return setDiff(true)
    if (r.timedOut) return r.retry()
    r.send({ type: 'admin-password', body: { password: p1 } }, () => {
      const left = getHospital().unconfirmed.length
      setHospital({ message: `관리 비밀번호를 바꿨어요.${left ? ` 설정 확인 안 된 침대 ${left}대가 남아 있어요.` : ''}` })
      onDone()
    })
  }
  return (
    <ObScreen
      title="관리 비밀번호 바꾸기"
      lead="바꾸면 다른 직원 폰도 새 비밀번호로 다시 들어와야 해요."
      primary={{ label: busy ? '바꾸는 중…' : r.timedOut ? '다시 시도' : '바꾸기', onPress: ok, disabled: p1.length !== 6 || p2.length !== 6 || busy }}
      secondary={{ label: '취소', onPress: () => { r.cancel(); onCancel() }, disabled: busy }}
    >
      <Text style={obStyles.label}>새 비밀번호 (숫자 6자리)</Text>
      <TextInput style={obStyles.input} value={p1} onChangeText={(t) => { setP1(digits6(t)); setDiff(false) }} secureTextEntry keyboardType="number-pad" maxLength={6} accessibilityLabel="새 비밀번호" />
      <Text style={obStyles.label}>한 번 더</Text>
      <TextInput style={[obStyles.input, diff && obStyles.inputBad]} value={p2} onChangeText={(t) => { setP2(digits6(t)); setDiff(false) }} secureTextEntry keyboardType="number-pad" maxLength={6} accessibilityLabel="새 비밀번호 한 번 더" />
      {diff && <Text style={obStyles.err} role="alert">두 비밀번호가 달라요. 다시 넣어 주세요.</Text>}
      {r.timedOut && <Text style={obStyles.noteBad}>바꾼 결과를 확인하지 못했어요. 다시 시도해 주세요.</Text>}
    </ObScreen>
  )
}

// 병원용 밤 시간(환자 앱): 병원 관리에서 정한 값을 보여 주기만 한다
export function NightInfo({ onOk }: { onOk: () => void }) {
  const bed = useBedInfo()
  const w = bed.ward ?? wardDefault()
  const n = w.night
  const lead = n.on
    ? `${clockLabel(n.from)}부터 다음 날 ${clockLabel(n.to)}까지는 '${w.name} 침대'라고 불러도 대답하지 않아요. ${
        bed.hasButton ? '이 시간에도 침대 버튼을 누르면 말할 수 있어요.' : '이 침대는 버튼이 없어 이 시간에는 말로 움직일 수 없어요.'
      }`
    : `밤에도 '${w.name} 침대'라고 부르면 대답해요. 대답 소리는 밤에 작게 나와요.`
  return (
    <ObScreen title="밤 시간" lead={lead} primary={{ label: '확인', onPress: onOk }}>
      {!bed.clockOk && (
        <Text style={obStyles.note}>지금은 침대가 시각을 몰라 밤 시간을 적용하지 않고 있어요. 침대와 연결되면 다시 적용해요.</Text>
      )}
      <Text style={obStyles.note}>병원에서 정한 설정이에요. 바꾸려면 병원 직원에게 말씀해 주세요.</Text>
    </ObScreen>
  )
}

const SHADOW = '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)'

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  red: { color: color.red, fontFamily: font.semiBold },
  down: { transform: [{ rotate: '90deg' }] },
  // 병실 묶음 머리(시안 .rhead)
  rhead: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 18, paddingRight: 16, gap: 10 },
  // 병실 고르기(시안 .nseg.rooms): 네 칸 격자
  rooms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  roomBtn: {
    width: '23%',
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: color.card,
    boxShadow: SHADOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomOn: { backgroundColor: color.ink },
  roomText: { fontFamily: font.semiBold, fontSize: 16, color: color.fg },
  roomTextOn: { fontFamily: font.bold, color: color['on-ink'] },
  pair: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 60, borderRadius: 22, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnWarn: { backgroundColor: color.red },
  btnText: { fontFamily: font.bold, fontSize: 20, color: color['on-ink'] },
  btnLight: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW,
  },
  btnLightText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  btnLightWarn: { fontFamily: font.bold, fontSize: 17, color: color.red },
})
