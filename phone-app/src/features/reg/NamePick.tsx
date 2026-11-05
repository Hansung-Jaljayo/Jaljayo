import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import { ObScreen, obStyles } from '@/components/ObScreen'
import { setBedInfo, useBedInfo } from '@/features/bed/bed'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { FRUITS, fruitXml, MY_BED, getHospital, setHospital, useHospital, usedNames } from '@/features/hospital/hospital'
import { color, font } from '@/theme/tokens'

type Props = {
  // 설정의 "부르는 이름 바꾸기"에서 들어왔는지. 아니면 등록 중 이름 정하기
  renaming: boolean
  // 처음부터 골라 둘 이름(다른 폰에서 넘겨받은 침대)
  preset?: string
  onDone: () => void
  onCancel: () => void
}

// 병원용: 같은 병실의 여러 침대 중 이 침대만 대답하게, 부르는 이름을 과일 12개에서 고른다.
// 같은 병실에서 쓰는 이름은 고를 수 없다. 이름은 침대에 저장하므로 침대가 답할 때 정해진다
export function NamePick({ renaming, preset = '', onDone, onCancel }: Props) {
  const bed = useBedInfo()
  const hosp = useHospital()
  const current = bed.ward?.name ?? ''
  const [pick, setPick] = useState(renaming ? current : preset)
  const [taken, setTaken] = useState(false)
  const r = useBedRequest()
  const me = hosp.beds.find((b) => b.id === MY_BED)
  const used = me ? usedNames(hosp.beds, me.room, MY_BED) : []
  const blocked = !bed.connected || bed.loading
  const pending = r.waiting
  const waiting = r.waiting && !r.timedOut

  const save = () => {
    if (blocked || !pick || waiting) return
    if (r.timedOut) return r.retry()
    const selected = pick
    setTaken(false)
    r.send({ type: 'name-save', body: { name: selected } }, (reply) => {
      // 그사이 같은 병실의 다른 침대가 먼저 이 이름을 썼으면 침대가 거절한다
      if (reply.ok === false) {
        setPick('')
        setTaken(true)
        return
      }
      if (bed.ward) setBedInfo({ ward: { ...bed.ward, name: selected } })
      setHospital({ beds: getHospital().beds.map((b) => (b.id === MY_BED ? { ...b, name: selected } : b)) })
      onDone()
    })
  }

  const label = waiting
    ? '저장 중…'
    : pending
      ? '다시 시도'
      : !pick
        ? '이름을 골라 주세요'
        : `${pick} 침대로 ${renaming ? '바꾸기' : '정하기'}`

  return (
    <ObScreen
      title="이 침대를 뭐라고 부를까요?"
      lead="고른 이름에 '침대'를 붙여 부를 때만 이 침대가 대답해요."
      primary={{
        label,
        onPress: save,
        disabled: blocked || waiting || !pick || (!pending && renaming && pick === current),
      }}
      secondary={{
        label: '취소',
        onPress: () => {
          if (waiting) return
          r.cancel()
          onCancel()
        },
        disabled: waiting,
      }}
    >
      <View style={styles.grid} role="radiogroup" accessibilityLabel="부르는 이름">
        {FRUITS.map((f) => {
          const isUsed = used.includes(f.name)
          const on = f.name === pick
          return (
            <Pressable
              key={f.name}
              style={[styles.fruit, on && styles.fruitOn, isUsed && styles.fruitUsed]}
              onPress={() => !pending && setPick(f.name)}
              disabled={isUsed || pending}
              role="radio"
              aria-checked={on}
              accessibilityLabel={isUsed ? `${f.name}, 사용 중` : f.name}
            >
              <SvgXml xml={fruitXml(f.svg, on ? color['on-ink'] : color.fg)} width={28} height={28} />
              <Text style={[styles.name, on && styles.nameOn]}>{f.name}</Text>
              <Text style={styles.used}>{isUsed ? '사용 중' : ' '}</Text>
            </Pressable>
          )
        })}
      </View>
      {(blocked || r.timedOut || taken) && (
        <Text style={obStyles.note} role="status">
          {blocked
            ? '침대와 연결되어 정보를 확인한 뒤 저장할 수 있어요.'
            : taken
              ? '다른 침대가 먼저 사용한 이름이에요. 다른 이름을 골라 주세요.'
              : '저장 결과를 확인하지 못했어요. 다시 시도하거나 기다리기를 취소해 주세요.'}
        </Text>
      )}
    </ObScreen>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  fruit: {
    width: '31.5%',
    height: 92,
    borderRadius: 20,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    boxShadow: '0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
  },
  fruitOn: { backgroundColor: color.ink },
  fruitUsed: { opacity: 0.4 },
  name: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  nameOn: { color: color['on-ink'] },
  used: { fontFamily: font.medium, fontSize: 12, color: color.muted },
})
