import { Image } from 'expo-image'
import { useCallback, useEffect, useState } from 'react'
import { Animated, Easing, type StyleProp, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Ko, ObScreen, obStyles, LinkText } from '@/components/ObScreen'
import { RippleButton } from '@/components/RippleButton'
import { Switch } from '@/components/Switch'
import { TimeWheels } from '@/components/TimeWheels'
import { clockLabel } from '@/features/alarm/alarm'
import { useInnerBack } from '@/features/app/flow'
import { type NightTime, setBedInfo, useBedInfo, wardDefault } from '@/features/bed/bed'
import { useBedRequest } from '@/features/bed/useBedRequest'
import {
  BED_NOS,
  CONTACT,
  type WardBed,
  applyAdminList,
  bedFrom,
  byNo,
  getHospital,
  idFromQr,
  qrFromId,
  reasonOf,
  setHospital,
  useHospital,
  usedNos,
} from '@/features/hospital/hospital'
import { useReduceMotion } from '@/components/useReduceMotion'
import QRScanScreen from '@/screens/QRScanScreen'
import { color, cssEase, font, motion } from '@/theme/tokens'

const digits6 = (t: string) => t.replace(/\D/g, '').slice(0, 6)
const nightSummary = (n: NightTime) =>
  n.on ? `${clockLabel(n.from)}부터 다음 날 ${clockLabel(n.to)}까지 꺼져요` : '밤에도 이름을 부르면 대답해요'

// 병원 관리 들어가기: 납품 때 병원마다 다르게 넣어 보낸 관리 비밀번호(숫자 6자리)
export function AdminPassword({ onIn, onOut }: { onIn: () => void; onOut: () => void }) {
  const [pw, setPw] = useState('')
  // 들어가지 못한 이유(비었으면 문제없음)
  const [bad, setBad] = useState('')
  const [help, setHelp] = useState(false)
  const r = useBedRequest()
  useInnerBack(() => r.waiting && !r.timedOut)
  const go = () => {
    if (pw.length !== 6 || r.waiting) return
    if (r.timedOut) return r.retry()
    r.send({ type: 'admin-login', body: { password: pw } }, (reply) => {
      if (reply.ok === false) return setBad(reasonOf(reply, '비밀번호가 맞지 않아요. 다시 넣어 주세요.'))
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
    >
      <Text style={obStyles.label}>관리 비밀번호 (숫자 6자리)</Text>
      <TextInput
        style={[obStyles.input, !!bad && obStyles.inputBad]}
        value={pw}
        onChangeText={(t) => { setPw(digits6(t)); setBad('') }}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel="관리 비밀번호"
        onSubmitEditing={go}
      />
      {!!bad && <Ko style={obStyles.err} role="alert">{bad}</Ko>}
      {r.timedOut && <Ko style={obStyles.noteBad}>침대와 연결이 잠시 끊겼어요. 다시 시도해 주세요.</Ko>}
      <RippleButton style={styles.linkBtn} rippleColor={color['fg-2']} onPress={() => setHelp((h) => !h)} aria-expanded={help}>
        <LinkText style={styles.linkText}>비밀번호를 잊었어요</LinkText>
      </RippleButton>
      {help && (
        <Ko style={obStyles.note}>
          {`잘자요 설치 담당자에게 연락해 주세요. 병원 담당자인지 확인한 뒤 새 비밀번호를 정해 드려요.\n문의: ${CONTACT}`}
        </Ko>
      )}
    </ObScreen>
  )
}

// 병원 침대 목록을 보드에 다시 받는다(admin-list). 화면에 들어올 때 한 번 보내고, 바꾼 뒤에는 reload로 다시 받는다
function useAdminList() {
  const { send, cancel, waiting } = useBedRequest()
  const [error, setError] = useState('')
  const request = useCallback(() => {
    send(
      { type: 'admin-list', body: {} },
      (reply) => {
        if (reply.ok === false) return setError(reasonOf(reply, '침대 목록을 받지 못했어요. 다시 불러와 주세요.'))
        applyAdminList(reply)
      },
      () => {
        cancel()
        setError('침대와 연결이 잠시 끊겨 침대 목록을 받지 못했어요. 다시 불러와 주세요.')
      },
    )
  }, [send, cancel])
  useEffect(() => {
    request()
  }, [request])
  const reload = () => {
    setError('')
    request()
  }
  return { loading: waiting, error, reload }
}

// 목록을 받지 못했을 때 안내 한 줄과 다시 불러오기
function ListError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <>
      <Ko style={obStyles.noteBad} role="alert">{text}</Ko>
      <RippleButton style={styles.linkBtn} rippleColor={color['fg-2']} onPress={onRetry}>
        <LinkText style={styles.linkText}>다시 불러오기</LinkText>
      </RippleButton>
    </>
  )
}

// 병원 설정: 밤 시간과 알람을 정해 등록된 병원 침대 전체에 보낸다. 답한 침대만 적용으로 센다
export function AdminHome({ onBeds, onPassword, onOut }: { onBeds: () => void; onPassword: () => void; onOut: () => void }) {
  const bed = useBedInfo()
  const hosp = useHospital()
  const list = useAdminList()
  const saved = bed.ward ?? wardDefault()
  const [night, setNight] = useState<NightTime>(saved.night)
  const [alarm, setAlarm] = useState(saved.alarmAllowed)
  const [openT, setOpenT] = useState<'from' | 'to' | null>(null)
  // 보드가 저장을 거절한 이유
  const [fail, setFail] = useState('')
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
    setFail('')
    // 병원 침대 전체에 적용한다(규격: admin-save {night, alarm})
    r.send({ type: 'admin-save', body: { night, alarm } }, (reply) => {
      if (reply.ok === false) return setFail(reasonOf(reply, '설정을 저장하지 못했어요. 다시 시도해 주세요.'))
      // 답하지 않은 침대 고유 번호를 보드가 알려 준다
      const miss = Array.isArray(reply.missing) ? reply.missing.filter((id): id is string => typeof id === 'string') : []
      setBedInfo({ ward: { ...(bed.ward ?? wardDefault()), night: { ...night }, alarmAllowed: alarm } })
      const all = getHospital().beds
      setHospital({
        beds: all.map((b) => ({ ...b, ok: !miss.includes(b.id) })),
        unconfirmed: miss,
        message: miss.length
          ? `등록된 ${all.length}대 중 ${all.length - miss.length}대 적용 · ${miss.length}대 확인 안 됨. 침대 전원과 와이파이를 확인하고 다시 보내 주세요.`
          : `등록된 ${all.length}대 모두 적용했어요.`,
      })
    })
  }

  return (
    <ObScreen
      title="병원 관리"
      lead={`잘자요 병원 · ${!hosp.loaded ? (list.loading ? '침대 목록을 받는 중이에요' : '침대 목록을 아직 받지 못했어요') : `등록된 침대 ${total}대`}. 저장하면 모든 침대에 보내요.`}
      secondary={{ label: '나가기', onPress: onOut, disabled: sending }}
    >
      {!!list.error && !list.loading && <ListError text={list.error} onRetry={list.reload} />}
      <Text style={obStyles.sec}>밤 시간</Text>
      <View style={[obStyles.card, obStyles.cardSmall]}>
        <View style={obStyles.switchRow}>
          <View style={styles.flex}>
            <Text style={obStyles.rowTitleBold}>밤에 이름 부르기 끄기</Text>
            <Ko style={obStyles.rowSub}>꺼진 동안에도 침대 버튼을 누르면 말할 수 있어요</Ko>
          </View>
          <Switch
            value={night.on}
            onValueChange={(on) => { setNight({ ...night, on }); if (!on) setOpenT(null) }}
            accessibilityLabel="밤에 이름 부르기 끄기"
            disabled={sending}
          />
        </View>
        {(['from', 'to'] as const).map((k) => (
          <View key={k} style={obStyles.rowLine}>
            <NRow
              label={k === 'from' ? '시작' : '끝'}
              value={clockLabel(night[k])}
              open={openT === k}
              disabled={!night.on || sending}
              onPress={() => setOpenT(openT === k ? null : k)}
            >
              <TimeWheels value={night[k]} onChange={(v) => setNight((n) => ({ ...n, [k]: v }))} disabled={sending} />
            </NRow>
          </View>
        ))}
      </View>
      <Ko style={obStyles.sum}>{nightSummary(night)}</Ko>

      <Text style={obStyles.sec}>알람</Text>
      <View style={[obStyles.card, obStyles.cardSmall]}>
        <View style={obStyles.switchRow}>
          <View style={styles.flex}>
            <Text style={obStyles.rowTitleBold}>병원 침대 전체 알람 활성화</Text>
            <Ko style={obStyles.rowSub}>끄면 환자 앱과 침대 모두 알람을 만들거나 울리지 않아요. 예약은 소리 없이 자세만 바꿔 그대로 써요</Ko>
          </View>
          <Switch value={alarm} onValueChange={setAlarm} accessibilityLabel="병원 침대 전체 알람 활성화" disabled={sending} />
        </View>
      </View>

      {!!hosp.message && !sending && !fail && (
        <Text style={hosp.unconfirmed.length ? obStyles.noteBad : obStyles.note} role="status">{hosp.message}</Text>
      )}
      {!!fail && !sending && <Ko style={obStyles.noteBad} role="alert">{fail}</Ko>}
      {r.timedOut && <Ko style={obStyles.noteBad}>보낸 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}
      {/* 시안: 저장 버튼은 침대 목록 위 */}
      <RippleButton style={[styles.btn, (sending || (same && !hosp.unconfirmed.length && !r.timedOut)) && styles.btnOff]} rippleColor={color['on-ink']} onPress={save} disabled={sending || (same && !hosp.unconfirmed.length && !r.timedOut)}>
        <Text style={styles.btnText}>{sending ? '보내는 중…' : r.timedOut ? '다시 시도' : retryOnly ? '모든 침대에 다시 보내기' : '모든 침대에 저장'}</Text>
      </RippleButton>

      <View style={obStyles.card}>
        <RippleButton style={styles.wrow} onPress={onBeds} disabled={sending}>
          <Text style={[obStyles.rowTitle, sending && styles.offText]}>침대 목록</Text>
          <Chev />
        </RippleButton>
        <RippleButton style={[styles.wrow, obStyles.rowLine]} onPress={onPassword} disabled={sending}>
          <Text style={[obStyles.rowTitle, sending && styles.offText]}>관리 비밀번호 바꾸기</Text>
          <Chev />
        </RippleButton>
      </View>
    </ObScreen>
  )
}

// 목록 줄·제목에 쓰는 침대 이름(예: 2번 침대 · 사과)
const bedLabel = (b: WardBed) => `${b.no}번 침대 · ${b.name ?? '이름 없음'}`

// 호실 순서: 보드가 알려 준 호실 다음에 목록에만 있는 호실
const roomOrder = (rooms: string[], beds: WardBed[]) => [...new Set([...rooms, ...beds.map((b) => b.room)])]

// 침대 목록: 들어올 때 보드에서 목록을 다시 받는다. 병실은 처음엔 모두 접혀 있고, 누르면 두루마리처럼 펼쳐진다.
// 확인 안 된 침대가 있는 병실은 접힌 줄에 빨간 글씨로 보여 준다
export function AdminBeds({ onBed, onAdd, onBack }: { onBed: (id: string) => void; onAdd: () => void; onBack: () => void }) {
  const hosp = useHospital()
  const list = useAdminList()
  const [open, setOpen] = useState<string[]>([])
  // 다른 화면으로 넘어가면 위 결과 한 줄은 지운다
  const leave = (go: () => void) => {
    setHospital({ bedsMessage: '' })
    go()
  }
  const rooms = roomOrder(hosp.rooms, hosp.beds).filter((r) => hosp.beds.some((b) => b.room === r))
  return (
    <ObScreen
      title="침대 목록"
      lead="호실을 누르면 침대가 펼쳐져요. 침대를 누르면 옮기거나 사용을 끝내거나 목록에서 뺄 수 있어요."
      secondary={{ label: '병원 관리로', onPress: () => leave(onBack) }}
    >
      <RippleButton style={styles.btn} rippleColor={color['on-ink']} onPress={() => leave(onAdd)}>
        <Text style={styles.btnText}>침대 추가</Text>
      </RippleButton>
      {!!hosp.bedsMessage && <Text style={obStyles.note} role="status">{hosp.bedsMessage}</Text>}
      {!!list.error && !list.loading && <ListError text={list.error} onRetry={list.reload} />}
      {!hosp.loaded && list.loading && <Ko style={obStyles.note}>침대 목록을 받는 중이에요.</Ko>}
      {hosp.loaded && !hosp.beds.length && !list.loading && (
        <Ko style={obStyles.note}>병원 목록에 넣은 침대가 없어요. 침대 추가를 눌러 보드 화면의 QR을 찍어 주세요.</Ko>
      )}
      {rooms.map((room) => {
        const bs = hosp.beds.filter((b) => b.room === room).sort(byNo)
        const bad = bs.filter((b) => !b.ok).length
        const isOpen = open.includes(room)
        return (
          <View key={room} style={[obStyles.card, obStyles.cardSmall]}>
            <RippleButton
              style={styles.rhead}
              onPress={() => setOpen(isOpen ? open.filter((x) => x !== room) : [...open, room])}
              aria-expanded={isOpen}
            >
              <View style={styles.flex}>
                <Text style={obStyles.rowTitleBold}>{room}</Text>
                <Ko style={obStyles.rowSub}>
                  {`침대 ${bs.length}대 · 환자 폰 ${bs.filter((b) => b.phone).length}대`}
                  {bad ? <Text style={styles.red}>{` · ${bad}대 확인 안 됨`}</Text> : null}
                </Ko>
              </View>
              <Chev open={isOpen} />
            </RippleButton>
            <Unroll open={isOpen}>
              {bs.map((b) => (
                <RippleButton key={b.id} style={[styles.wrow, obStyles.rowLine]} onPress={() => leave(() => onBed(b.id))}>
                  <View style={styles.flex}>
                    <Text style={obStyles.rowTitleBold}>{bedLabel(b)}</Text>
                    <Ko style={[obStyles.rowSub, !b.ok && styles.red]}>
                      {`${b.phone ? '환자 폰 연결됨' : '환자 폰 없음'}${b.ok ? '' : ' · 설정 확인 안 됨'}`}
                    </Ko>
                  </View>
                  <Chev />
                </RippleButton>
              ))}
            </Unroll>
          </View>
        )
      })}
    </ObScreen>
  )
}

// 호실·침대 번호 고르기 칸. 같은 호실에서 다른 침대가 쓰는 번호는 흐리게 막는다
function PlaceCard({
  rooms,
  beds,
  exceptId,
  room,
  no,
  from,
  openP,
  setOpenP,
  onRoom,
  onNo,
  disabled,
}: {
  rooms: string[]
  beds: WardBed[]
  exceptId: string
  room: string
  no: number
  // 옮기기면 지금 자리(값 칸에 "지금 → 고른 것"으로 보인다)
  from?: { room: string; no: number }
  openP: 'room' | 'no' | null
  setOpenP: (p: 'room' | 'no' | null) => void
  onRoom: (room: string) => void
  onNo: (no: number) => void
  disabled: boolean
}) {
  const taken = usedNos(beds, room, exceptId)
  const roomVal = !room ? '골라 주세요' : from && from.room !== room ? `${from.room} → ${room}` : room
  const noVal = !no ? '골라 주세요' : from && (from.no !== no || from.room !== room) ? `${from.no}번 → ${no}번` : `${no}번`
  return (
    <View style={[obStyles.card, obStyles.cardSmall]}>
      <NRow label="호실" value={roomVal} open={openP === 'room'} disabled={disabled} onPress={() => setOpenP(openP === 'room' ? null : 'room')}>
        <View style={styles.rooms} role="radiogroup" accessibilityLabel="호실">
          {rooms.map((r) => (
            <RippleButton
              key={r}
              style={[styles.roomBtn, r === room && styles.roomOn]}
              rippleColor={r === room ? color['on-ink'] : color.fg}
              disabled={disabled}
              onPress={() => onRoom(r)}
              role="radio"
              aria-checked={r === room}
            >
              <Text style={[styles.roomText, r === room && styles.roomTextOn]}>{r}</Text>
            </RippleButton>
          ))}
        </View>
      </NRow>
      <View style={obStyles.rowLine}>
        <NRow label="침대 번호" value={noVal} open={openP === 'no'} disabled={disabled || !room} onPress={() => setOpenP(openP === 'no' ? null : 'no')}>
          <View style={styles.rooms} role="radiogroup" accessibilityLabel="침대 번호">
            {BED_NOS.map((n) => {
              const used = taken.includes(n)
              return (
                <RippleButton
                  key={n}
                  style={[styles.roomBtn, styles.noBtn, n === no && styles.roomOn, used && styles.dim]}
                  rippleColor={n === no ? color['on-ink'] : color.fg}
                  disabled={disabled || used}
                  onPress={() => onNo(n)}
                  role="radio"
                  aria-checked={n === no}
                  accessibilityLabel={used ? `${n}번, 다른 침대가 있음` : `${n}번`}
                >
                  <Text style={[styles.roomText, n === no && styles.roomTextOn]}>{`${n}번`}</Text>
                </RippleButton>
              )
            })}
          </View>
        </NRow>
      </View>
    </View>
  )
}

// 첫 빈 번호(없으면 0)
const firstFree = (beds: WardBed[], room: string, exceptId: string) => {
  const taken = usedNos(beds, room, exceptId)
  return BED_NOS.find((n) => !taken.includes(n)) ?? 0
}

// 침대 추가: QR 찍기(또는 고유 번호 입력) → 호실·침대 번호 고르기 → admin-add
export function AdminAdd({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const hosp = useHospital()
  const [scan, setScan] = useState(true)
  // QR에서 읽은 글. 카메라를 쓸 수 없으면 비워 두고 고유 번호를 칸에 넣는다
  const [qr, setQr] = useState('')
  const [typed, setTyped] = useState('')
  const [room, setRoom] = useState('')
  const [no, setNo] = useState(0)
  const [openP, setOpenP] = useState<'room' | 'no' | null>('room')
  const [fail, setFail] = useState('')
  const r = useBedRequest()
  const busy = r.waiting && !r.timedOut
  // 뒤로: 추가하는 중이면 막고, 자리 고르기 화면이면 QR 화면으로
  useInnerBack(() => {
    if (busy) return true
    if (!scan) {
      r.cancel()
      setFail('')
      setScan(true)
      return true
    }
    return false
  })
  // 답을 기다리다 끊긴 뒤 값을 바꾸면 그 요청은 버리고 새로 보낸다
  const changed = () => {
    if (r.timedOut) r.cancel()
    setFail('')
  }
  const id = qr ? idFromQr(qr) : typed.trim()
  const ready = !!id && !!room && !!no

  if (scan) {
    return (
      <QRScanScreen
        title="침대 추가"
        description="병원 목록에 넣을 침대의 보드 화면에 보이는 QR 코드를 네모 안에 비춰 주세요."
        onScanned={(d) => {
          setQr(d)
          setScan(false)
        }}
        onDenied={() => {
          setQr('')
          setScan(false)
        }}
        onCancel={onCancel}
      />
    )
  }

  const add = () => {
    if (busy || !ready) return
    if (r.timedOut) return r.retry()
    setFail('')
    r.send({ type: 'admin-add', body: { qr: qr || qrFromId(id), room, no } }, (reply) => {
      if (reply.ok === false) return setFail(reasonOf(reply, '침대를 추가하지 못했어요. 다시 시도해 주세요.'))
      const nb = bedFrom(reply.bed)
      const beds = getHospital().beds
      setHospital({
        beds: nb ? [...beds.filter((x) => x.id !== nb.id), nb] : beds,
        bedsMessage: `${room} ${no}번에 침대를 추가했어요.`,
      })
      onDone()
    })
  }

  return (
    <ObScreen
      title="침대 자리 고르기"
      lead={qr ? `고유 번호 ${id} 침대를 넣을 호실과 침대 번호를 골라 주세요.` : '보드 화면의 QR 아래에 적힌 고유 번호를 넣고, 호실과 침대 번호를 골라 주세요.'}
      primary={{
        label: busy
          ? '추가하는 중…'
          : r.timedOut
            ? '다시 시도'
            : !id
              ? '고유 번호를 넣어 주세요'
              : !room
                ? '호실을 골라 주세요'
                : !no
                  ? '침대 번호를 골라 주세요'
                  : `${room} ${no}번에 추가하기`,
        onPress: add,
        disabled: busy || (!r.timedOut && !ready),
      }}
      secondary={{ label: '취소', onPress: () => { r.cancel(); onCancel() }, disabled: busy }}
      links={[{ label: 'QR 다시 찍기', onPress: () => { r.cancel(); setFail(''); setScan(true) }, disabled: busy }]}
    >
      {!qr && (
        <>
          <Text style={obStyles.label}>침대 고유 번호</Text>
          <TextInput
            style={obStyles.input}
            value={typed}
            onChangeText={(t) => { setTyped(t); changed() }}
            placeholder="예: B7Q2-1"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            accessibilityLabel="침대 고유 번호"
          />
        </>
      )}
      <PlaceCard
        rooms={hosp.rooms}
        beds={hosp.beds}
        exceptId=""
        room={room}
        no={no}
        openP={openP}
        setOpenP={setOpenP}
        onRoom={(v) => {
          changed()
          setRoom(v)
          setNo(firstFree(hosp.beds, v, ''))
          setOpenP('no')
        }}
        onNo={(n) => {
          changed()
          setNo(n)
          setOpenP(null)
        }}
        disabled={busy}
      />
      {!!fail && !busy && <Ko style={obStyles.noteBad} role="alert">{fail}</Ko>}
      {r.timedOut && <Ko style={obStyles.noteBad}>추가한 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}
    </ObScreen>
  )
}

// 침대 하나: 옮기기(호실·침대 번호), 환자 사용 끝내기, 목록에서 빼기
export function AdminBed({ onBack }: { onBack: () => void }) {
  const hosp = useHospital()
  const list = useAdminList()
  const b = hosp.beds.find((x) => x.id === hosp.bedId)
  const [room, setRoom] = useState(b?.room ?? '')
  const [no, setNo] = useState(b?.no ?? 0)
  const [openP, setOpenP] = useState<'room' | 'no' | null>(null)
  const [asking, setAsking] = useState(false)
  const [removing, setRemoving] = useState(false)
  // 마지막으로 한 일의 결과 한 줄
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const mv = useBedRequest()
  const end = useBedRequest()
  const rm = useBedRequest()
  const busy = (mv.waiting && !mv.timedOut) || (end.waiting && !end.timedOut) || (rm.waiting && !rm.timedOut)
  // 뒤로: 보내는 중이면 막고, 확인 창·사용 끝내기 확인 줄·펼친 칸이 있으면 그것만 닫는다
  useInnerBack(() => {
    if (busy) return true
    if (removing) {
      setRemoving(false)
      return true
    }
    if (asking) {
      setAsking(false)
      return true
    }
    if (openP) {
      setOpenP(null)
      return true
    }
    return false
  })
  if (!b) {
    return (
      <ObScreen
        title="침대를 찾지 못했어요"
        lead={list.loading ? '침대 목록을 다시 받는 중이에요.' : '병원 목록에 이 침대가 없어요. 다른 기기에서 목록에서 뺐을 수 있어요.'}
        secondary={{ label: '침대 목록으로', onPress: onBack }}
      />
    )
  }
  const same = room === b.room && no === b.no
  const clash = !no || usedNos(hosp.beds, room, b.id).includes(no)
  const mine = () => getHospital().mine?.id === b.id
  // 답을 기다리다 끊긴 뒤 자리를 바꾸면 그 요청은 버리고 새로 보낸다
  const changed = () => {
    if (mv.timedOut) mv.cancel()
    setNote(null)
  }

  const move = () => {
    if (busy || same || clash) return
    if (mv.timedOut) return mv.retry()
    setNote(null)
    mv.send({ type: 'admin-move', body: { bed: b.id, room, no } }, (reply) => {
      if (reply.ok === false) return setNote({ text: reasonOf(reply, '옮기지 못했어요. 다시 시도해 주세요.'), bad: true })
      const nb = bedFrom(reply.bed)
      const cleared = reply.nameCleared === true
      setHospital({
        beds: getHospital().beds.map((x) => (x.id === b.id ? { ...x, room, no, name: cleared ? null : nb ? nb.name : x.name } : x)),
        mine: mine() ? { ...getHospital().mine!, room, no } : getHospital().mine,
      })
      setNote({
        text: cleared
          ? `${room} ${no}번으로 옮겼어요. ${room}에 같은 과일 이름을 쓰는 침대가 있어 이 침대 이름을 비웠어요. 환자 앱에서 이름을 다시 골라야 해요.`
          : `${room} ${no}번으로 옮겼어요.`,
        bad: false,
      })
      list.reload()
    })
  }
  const finish = () => {
    if (busy) return
    if (end.timedOut) return end.retry()
    setNote(null)
    end.send({ type: 'admin-end', body: { bed: b.id } }, (reply) => {
      setAsking(false)
      if (reply.ok === false) return setNote({ text: reasonOf(reply, '사용을 끝내지 못했어요. 다시 시도해 주세요.'), bad: true })
      setHospital({
        beds: getHospital().beds.map((x) => (x.id === b.id ? { ...x, phone: false, name: null } : x)),
        endedMine: getHospital().endedMine || mine(),
      })
      setNote({ text: '사용을 끝냈어요. 이름, 알람, 예약, 자세 기록을 지우고 환자 폰 연결을 끊었어요.', bad: false })
      list.reload()
    })
  }
  const remove = () => {
    setRemoving(false)
    if (busy) return
    setNote(null)
    rm.send({ type: 'admin-remove', body: { bed: b.id } }, (reply) => {
      if (reply.ok === false) return setNote({ text: reasonOf(reply, '목록에서 빼지 못했어요. 다시 시도해 주세요.'), bad: true })
      setHospital({
        beds: getHospital().beds.filter((x) => x.id !== b.id),
        bedsMessage: `${b.room} ${b.no}번 침대를 목록에서 뺐어요.`,
        endedMine: getHospital().endedMine || mine(),
      })
      onBack()
    })
  }

  return (
    <ObScreen
      title={bedLabel(b)}
      lead={`${b.room} · 고유 번호 ${b.id} · ${b.phone ? '환자 폰 연결됨' : '환자 폰 없음'}`}
      secondary={{ label: '침대 목록으로', onPress: onBack, disabled: busy }}
    >
      {!!note && !busy && (
        <Ko style={note.bad ? obStyles.noteBad : obStyles.note} role={note.bad ? 'alert' : 'status'}>{note.text}</Ko>
      )}
      {!!list.error && !list.loading && <ListError text={list.error} onRetry={list.reload} />}

      <Text style={obStyles.sec}>자리 옮기기</Text>
      <PlaceCard
        rooms={hosp.rooms}
        beds={hosp.beds}
        exceptId={b.id}
        room={room}
        no={no}
        from={{ room: b.room, no: b.no }}
        openP={openP}
        setOpenP={setOpenP}
        onRoom={(v) => {
          changed()
          setRoom(v)
          if (usedNos(hosp.beds, v, b.id).includes(no) || !no) setNo(v === b.room ? b.no : firstFree(hosp.beds, v, b.id))
          setOpenP('no')
        }}
        onNo={(n) => {
          changed()
          setNo(n)
          setOpenP(null)
        }}
        disabled={busy}
      />
      <Ko style={obStyles.note}>옮긴 호실에 같은 과일 이름을 쓰는 침대가 있으면 이 침대 이름을 비워요. 환자가 앱에서 다시 골라요.</Ko>
      <RippleButton
        style={[styles.btn, (busy || same || clash) && !mv.timedOut && styles.btnOff]}
        rippleColor={color['on-ink']}
        onPress={move}
        disabled={(busy || same || clash) && !mv.timedOut}
      >
        <Text style={styles.btnText}>
          {mv.waiting && !mv.timedOut
            ? '옮기는 중…'
            : mv.timedOut
              ? '다시 시도'
              : same
                ? '옮길 자리를 골라 주세요'
                : clash
                  ? '침대 번호를 골라 주세요'
                  : `${room} ${no}번으로 옮기기`}
        </Text>
      </RippleButton>
      {mv.timedOut && <Ko style={obStyles.noteBad}>옮긴 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}

      <Text style={obStyles.sec}>환자 사용</Text>
      <Ko style={obStyles.note}>
        사용을 끝내면 이 침대의 이름, 알람, 예약, 자세 기록을 지우고 환자 폰 연결을 끊어요. 호실, 침대 번호, 병원 설정은 그대로예요. 다음 환자는 침대 QR을 찍어 등록하고 이름을 새로 골라요.
      </Ko>
      {!asking ? (
        <RippleButton style={styles.btnLight} rippleColor={color.red} onPress={() => setAsking(true)} disabled={busy || (!b.phone && !b.name)}>
          {/* 막히면 글자만 흐린 색(시안 .ob .secondary:disabled) */}
          <Text style={[styles.btnLightWarn, (busy || (!b.phone && !b.name)) && styles.offText]}>{b.phone || b.name ? '사용 끝내기' : '쓰는 환자가 없어요'}</Text>
        </RippleButton>
      ) : (
        <View style={styles.pair}>
          <RippleButton style={[styles.btn, styles.btnWarn, busy && styles.btnOff, styles.flex]} rippleColor={color['on-ink']} onPress={finish} disabled={busy}>
            <Text style={styles.btnText}>{end.waiting && !end.timedOut ? '끝내는 중…' : end.timedOut ? '다시 시도' : '사용 끝내기'}</Text>
          </RippleButton>
          <RippleButton style={[styles.btnLight, styles.flex]} onPress={() => { end.cancel(); setAsking(false) }} disabled={busy}>
            <Text style={[styles.btnLightText, busy && styles.offText]}>취소</Text>
          </RippleButton>
        </View>
      )}
      {end.timedOut && <Ko style={obStyles.noteBad}>사용을 끝낸 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}

      <Text style={obStyles.sec}>목록에서 빼기</Text>
      <Ko style={obStyles.note}>
        빼면 이 침대의 호실, 침대 번호, 이름과 알람, 예약, 자세 기록을 지워요. 보드 화면에 QR이 다시 보여 침대 추가로 다시 넣을 수 있어요.
      </Ko>
      <RippleButton
        style={styles.btnLight}
        rippleColor={color.red}
        onPress={() => (rm.timedOut ? rm.retry() : setRemoving(true))}
        disabled={busy}
      >
        <Text style={[styles.btnLightWarn, busy && styles.offText]}>
          {rm.waiting && !rm.timedOut ? '빼는 중…' : rm.timedOut ? '다시 시도' : '목록에서 빼기'}
        </Text>
      </RippleButton>
      {rm.timedOut && <Ko style={obStyles.noteBad}>목록에서 뺀 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}
      <ConfirmDialog
        open={removing}
        title="목록에서 뺄까요?"
        message={`${b.room} ${b.no}번 침대를 병원 목록에서 빼요. 이 침대의 알람, 예약, 자세 기록도 지워져요.`}
        okLabel="빼기"
        noLabel="취소"
        onOk={remove}
        onClose={() => setRemoving(false)}
      />
    </ObScreen>
  )
}

// 관리 비밀번호 바꾸기: 퇴사자가 계속 들어오지 않게. 바꾸면 다른 직원 폰도 새 비밀번호로 다시 들어온다
export function AdminPasswordChange({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [diff, setDiff] = useState(false)
  // 보드가 거절한 이유
  const [fail, setFail] = useState('')
  const r = useBedRequest()
  const busy = r.waiting && !r.timedOut
  useInnerBack(() => busy)
  const ok = () => {
    if (p1.length !== 6 || p2.length !== 6 || busy) return
    if (p1 !== p2) return setDiff(true)
    if (r.timedOut) return r.retry()
    setFail('')
    r.send({ type: 'admin-password', body: { password: p1 } }, (reply) => {
      if (reply.ok === false) return setFail(reasonOf(reply, '관리 비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.'))
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
      <TextInput style={obStyles.input} value={p1} onChangeText={(t) => { setP1(digits6(t)); setDiff(false); setFail('') }} secureTextEntry keyboardType="number-pad" maxLength={6} accessibilityLabel="새 비밀번호" />
      <Text style={obStyles.label}>한 번 더</Text>
      <TextInput style={[obStyles.input, diff && obStyles.inputBad]} value={p2} onChangeText={(t) => { setP2(digits6(t)); setDiff(false); setFail('') }} secureTextEntry keyboardType="number-pad" maxLength={6} accessibilityLabel="새 비밀번호 한 번 더" />
      {diff && <Ko style={obStyles.err} role="alert">두 비밀번호가 달라요. 다시 넣어 주세요.</Ko>}
      {!!fail && !busy && <Ko style={obStyles.err} role="alert">{fail}</Ko>}
      {r.timedOut && <Ko style={obStyles.noteBad}>바꾼 결과를 확인하지 못했어요. 다시 시도해 주세요.</Ko>}
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
        <Ko style={obStyles.note}>지금은 침대가 시각을 몰라 밤 시간을 적용하지 않고 있어요. 침대와 연결되면 다시 적용해요.</Ko>
      )}
      <Ko style={obStyles.note}>병원에서 정한 설정이에요. 바꾸려면 병원 직원에게 말씀해 주세요.</Ko>
    </ObScreen>
  )
}

const SHADOW = '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)'

const styles = StyleSheet.create({
  flex: { flex: 1 },
  red: { color: color.red, fontFamily: font.semiBold },
  // 막힌 흰 버튼·목록 줄의 글자(시안 #b3a6a1)
  offText: { color: '#b3a6a1' },
  icon20: { width: 20, height: 20 },
  // 흰 목록 줄(시안 .ob .wlist button)
  wrow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, gap: 12 },
  // 이름 · 값 · 화살표 줄(시안 .ob .nbtn): 막히면 40%
  nbtn: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  nbtnOff: { opacity: 0.4 },
  nbtnLabel: { flex: 1, fontFamily: font.semiBold, fontSize: 17, color: color.fg },
  nbtnVal: { fontFamily: font.semiBold, fontSize: 17, color: color['fg-2'] },
  // 펼친 칸(시안 .ob .npanel)
  npanel: { paddingHorizontal: 12, paddingBottom: 12 },
  // 칸 높이와 상관없이 제 높이로 놓여 잴 수 있게 띄운다(ExpandRow panelIn과 같음)
  npanelIn: { position: 'absolute', top: 0, left: 0, right: 0 },
  // 병실 묶음 머리(시안 .rhead)
  rhead: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 18, paddingRight: 16, gap: 10 },
  // 호실 고르기(시안 .nseg.rooms): 네 칸 격자
  rooms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  // 침대 번호 고르기: 다섯 칸 격자
  noBtn: { width: '18%' },
  roomOn: { backgroundColor: color.ink },
  // 다른 침대가 쓰는 번호
  dim: { opacity: 0.4 },
  roomText: { fontFamily: font.semiBold, fontSize: 16, color: color.fg },
  roomTextOn: { fontFamily: font.bold, color: color['on-ink'] },
  pair: { flexDirection: 'row', gap: 8 },
  linkBtn: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 },
  linkText: { fontFamily: font.bold, fontSize: 17, color: color['fg-2'], textDecorationLine: 'underline' },
  btn: { minHeight: 60, borderRadius: 22, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnWarn: { backgroundColor: color.red },
  // 시안: 막힌 큰 버튼은 연한 바탕·흰 글자
  btnOff: { backgroundColor: color.switchOff },
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

const EASE = Easing.bezier(...cssEase)

// 오른쪽 화살표. open이 있으면 펼칠 때 0.2초 동안 아래로 돈다(시안 .nbtn svg, .rhead svg transition: transform .2s)
function Chev({ open }: { open?: boolean }) {
  const [turn] = useState(() => new Animated.Value(open ? 1 : 0))
  useEffect(() => {
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true }).start()
  }, [open, turn])
  return (
    <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
      <Image source={require('../../../assets/icons/chevron.svg')} style={styles.icon20} />
    </Animated.View>
  )
}

// 이름 · 값 · 화살표 줄(시안 .nbtn). 11/19: 누르면 아래 칸이 탁 나타나지 않고 두루마리처럼 높이가 늘며 펼쳐진다(ExpandRow와 같은 움직임)
function NRow({
  label,
  value,
  open,
  disabled,
  onPress,
  children,
}: {
  label: string
  value: string
  open: boolean
  disabled: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <RippleButton
        style={[styles.nbtn, disabled && styles.nbtnOff]}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={`${label} ${value}`}
        accessibilityState={{ expanded: open, disabled }}
      >
        <Text style={styles.nbtnLabel}>{label}</Text>
        <Text style={styles.nbtnVal}>{value}</Text>
        <Chev open={open} />
      </RippleButton>
      <Unroll open={open} style={styles.npanel}>
        {children}
      </Unroll>
    </>
  )
}

// 펼침 칸: 탁 나타나지 않고 두루마리처럼 높이가 늘며 펼쳐진다(ExpandRow와 같은 움직임). 이름 줄 아래 칸과 침대 목록의 병실 묶음이 같이 쓴다
function Unroll({ open, style, children }: { open: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduceMotion = useReduceMotion()
  const [shown] = useState(() => new Animated.Value(open ? 1 : 0))
  const [panelH, setPanelH] = useState(0)
  // 접힌 뒤에도 내용을 잠깐 남겨 두었다가(접히는 동안 보이게) 다 접히면 뺀다
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    const to = open ? 1 : 0
    if (reduceMotion) {
      shown.setValue(to)
      return
    }
    const a = Animated.timing(shown, {
      toValue: to,
      duration: motion.rowPanel.duration,
      easing: Easing.bezier(...motion.rowPanel.bezier),
      useNativeDriver: false,
    })
    a.start(({ finished }) => {
      if (finished && !open) setMounted(false)
    })
    return () => a.stop()
  }, [open, reduceMotion, shown])
  // 움직임 줄이기 설정이면 접을 때 바로 뺀다
  if (!mounted || (reduceMotion && !open)) return null
  return (
    <Animated.View
      style={{ overflow: 'hidden', height: shown.interpolate({ inputRange: [0, 1], outputRange: [0, panelH] }) }}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <View style={[style, styles.npanelIn]} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  )
}
