import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/TabBar'
import { goOb } from '@/features/app/flow'
import { getNightOverride, setBedInfo, setNightOverride, useBedInfo, wardDefault } from '@/features/bed/bed'
import { type BedReply, pendingRequests, receiveBedReply } from '@/features/bed/requests'
import { getHospital } from '@/features/hospital/hospital'
import { sampleResv, setResvState, useResvState } from '@/features/resv/resv'
import { color, font, radius, shadow, space } from '@/theme/tokens'

import { DevSwitch } from './DevSwitch'
import { useDevScene } from './useDevScene'

// 침대 대신 답할 때 고르는 상황(켜 두면 다음 "침대 답 보내기"부터 계속 쓴다)
type Fake = { taken: boolean; wardBed: boolean; noWifi: boolean; wrongPw: boolean; adminBad: boolean; apart: boolean; nameTaken: boolean }

// 개발할 때만 쓰는 시험 도구 모음. 침대가 알려 줄 정보(침대 정보, 예약 상태)를 손으로 바꾸고,
// 침대와 주고받는 길이 아직 없으니 기다리는 요청에 침대 대신 답해 화면을 확인한다.
// 앱은 이 폴더를 모른다(그 값만 바꾼다). 떼려면 src/dev 폴더와 src/app/_layout.tsx의 DevTools 두 줄을 지우면 된다.
// README대로 시험 도구는 실제 앱에 넣지 않으므로 개발 빌드(__DEV__)에서만 그린다
export function DevTools() {
  const bed = useBedInfo()
  const resv = useResvState()
  const insets = useSafeAreaInsets()
  // 화면을 덜 가리도록 평소엔 "시험" 버튼만 보이고, 누르면 스위치들이 펼쳐진다
  const [open, setOpen] = useState(false)
  const [fake, setFake] = useState<Fake>({ taken: false, wardBed: false, noWifi: false, wrongPw: false, adminBad: false, apart: false, nameTaken: false })
  const [, rerender] = useState(0)
  useDevScene()
  if (!__DEV__) return null
  const blocked = !!bed.ward && !bed.ward.alarmAllowed
  const f = (k: keyof Fake) => (on: boolean) => setFake({ ...fake, [k]: on })

  // 기다리는 요청마다 고른 상황에 맞는 답을 보낸다
  const reply = () => {
    for (const { id, message } of pendingRequests()) {
      let r: BedReply = {}
      switch (message.type) {
        case 'bed-find':
          r = { taken: fake.taken, ward: fake.wardBed, name: '사과' }
          break
        case 'bed-register':
          r = { ward: fake.wardBed, name: '사과' }
          break
        case 'wifi-scan':
          r = { networks: fake.noWifi ? [] : ['Home_2G', 'Home_5G', 'Guest'] }
          break
        case 'wifi-set':
          r = fake.wrongPw ? { ok: false, reason: 'password' } : { ok: true }
          break
        case 'admin-login':
          r = { ok: !fake.adminBad }
          break
        case 'admin-save':
          r = { missing: fake.apart ? getHospital().beds.filter((b) => b.room === '305호').slice(0, 2).map((b) => b.id) : [] }
          break
        case 'name-save':
          r = { ok: !fake.nameTaken }
          break
      }
      receiveBedReply(id, r)
    }
  }

  return (
    // 탭 막대 바로 위 오른쪽에 쌓아 띄운다. 빈 자리는 누름이 아래 화면으로 지나간다
    <View style={[styles.stack, { bottom: TAB_BAR_SPACE + insets.bottom }]} pointerEvents="box-none">
      {open && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          <View style={styles.btns}>
            <DevButton label="침대 답 보내기" onPress={reply} />
            <DevButton
              label="처음부터 등록"
              onPress={() => {
                setBedInfo({ registered: false })
                goOb('scan')
              }}
            />
            <DevButton label="다른 폰에 밀려남" onPress={() => goOb('kicked')} />
            <DevButton label="로컬 네트워크 거부" onPress={() => goOb('nolan')} />
            <DevButton
              label="홈 화면"
              onPress={() => {
                setBedInfo({ registered: true })
                goOb(null)
              }}
            />
          </View>
          <Text style={styles.head}>침대 답 상황</Text>
          <DevSwitch label="다른 폰에 등록된 침대" value={fake.taken} onValueChange={f('taken')} />
          <DevSwitch label="찾은 침대가 병원용" value={fake.wardBed} onValueChange={f('wardBed')} />
          <DevSwitch label="와이파이 목록 없음" value={fake.noWifi} onValueChange={f('noWifi')} />
          <DevSwitch label="와이파이 비밀번호 틀림" value={fake.wrongPw} onValueChange={f('wrongPw')} />
          <DevSwitch label="부르는 이름 먼저 쓰임" value={fake.nameTaken} onValueChange={f('nameTaken')} />
          <DevSwitch label="관리 비밀번호 틀림" value={fake.adminBad} onValueChange={f('adminBad')} />
          <DevSwitch label="일부 침대 응답 없음" value={fake.apart} onValueChange={f('apart')} />
          <Text style={styles.head}>침대 정보</Text>
          {/* 자세 탭: 연결이 끊기면 버튼이 잠기고 연결 끊김 안내가 뜬다 */}
          <DevSwitch label="연결 끊김" value={!bed.connected} onValueChange={(on) => setBedInfo({ connected: !on })} />
          {/* 침대가 지금 시각을 모르는 상태: 알람·예약 탭에 시계 무효 띠가 뜬다 */}
          <DevSwitch label="시각 모름" value={!bed.clockOk} onValueChange={(on) => setBedInfo({ clockOk: !on })} />
          {/* 첫 번째 알람이 지금 울리는 중(그 알람은 바꿀 수 없고 침대 초기화도 막힌다) */}
          <DevSwitch label="알람 울리는 중" value={bed.ringingId != null} onValueChange={(on) => setBedInfo({ ringingId: on ? 1 : null })} />
          <DevSwitch label="버튼 없는 침대" value={!bed.hasButton} onValueChange={(on) => setBedInfo({ hasButton: !on })} />
          {/* 병원용 침대(사과 침대). 끄면 집 침대로 돌아간다 */}
          <DevSwitch label="병원용 침대" value={!!bed.ward} onValueChange={(on) => setBedInfo({ ward: on ? wardDefault() : null })} />
          {/* 병원에서 알람을 막는다(병원용 침대로 바꾼다) */}
          <DevSwitch
            label="병원에서 알람을 막음"
            value={blocked}
            onValueChange={(on) => setBedInfo({ ward: { ...(bed.ward ?? wardDefault()), alarmAllowed: !on } })}
          />
          {/* 지금이 밤 시간인 것처럼(병원용 홈의 밤 안내 줄) */}
          <DevSwitch
            label="지금 밤 시간"
            value={getNightOverride() === true}
            onValueChange={(on) => {
              setNightOverride(on ? true : null)
              rerender((n) => n + 1)
            }}
          />
          {/* 예약 탭: 끄면 표본 예약(오후 11:10 잠 자세)이 생긴다 */}
          <DevSwitch
            label="예약 없음"
            value={resv.item == null}
            onValueChange={(on) => setResvState({ item: on ? null : sampleResv().item })}
          />
          {/* 예약 탭: 지난 예약을 실행하지 못한 기록 카드 */}
          <DevSwitch
            label="실패 기록"
            value={resv.fail != null}
            onValueChange={(on) => setResvState({ fail: on ? sampleResv().fail : null })}
          />
        </ScrollView>
      )}
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((o) => !o)}
        role="button"
        accessibilityLabel={open ? '시험 도구 접기' : '시험 도구 펼치기'}
      >
        <Text style={styles.toggleText}>{open ? '시험 접기' : '시험'}</Text>
      </Pressable>
    </View>
  )
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.toggle} onPress={onPress} role="button" accessibilityLabel={`시험: ${label}`}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', right: 18, left: 18, alignItems: 'flex-end', gap: space[6] },
  scroll: { maxHeight: 460 },
  list: { alignItems: 'flex-end', gap: space[6] },
  btns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[6] },
  head: { fontFamily: font.bold, fontSize: 13, color: color.muted, marginTop: space[4] },
  toggle: {
    paddingHorizontal: space[12],
    paddingVertical: space[6],
    borderRadius: radius[26],
    backgroundColor: color.card,
    boxShadow: shadow.card,
  },
  toggleText: { fontFamily: font.bold, fontSize: 13, color: color.red },
  btnText: { fontFamily: font.semiBold, fontSize: 13, color: color.fg },
})
