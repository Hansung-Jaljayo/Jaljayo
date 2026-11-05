import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import { ObScreen, obStyles } from '@/components/ObScreen'
import { useInnerBack } from '@/features/app/flow'
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
  // 저장 중에는 뒤로도 막는다(취소 버튼도 막혀 있다)
  useInnerBack(() => waiting)

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
      <FruitGrid label="부르는 이름" value={pick} used={used} disabled={pending} onPick={setPick} />
      {(blocked || r.timedOut || taken) && (
        <Text style={obStyles.noteBad} role="status">
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

// 과일 이름 고르기(시안 .fruits): 세 줄 격자, 동그라미 그림 아래 이름. 같은 병실에서 쓰는 이름은 흐리게 막는다
export function FruitGrid({
  label,
  value,
  used,
  disabled,
  onPick,
}: {
  label: string
  value: string
  used: string[]
  disabled?: boolean
  onPick: (name: string) => void
}) {
  return (
    <View style={styles.grid} role="radiogroup" accessibilityLabel={label}>
      {FRUITS.map((f) => {
        const isUsed = used.includes(f.name)
        const on = f.name === value
        return (
          <Pressable
            key={f.name}
            style={styles.fruit}
            onPress={() => !disabled && onPick(f.name)}
            disabled={isUsed || disabled}
            role="radio"
            aria-checked={on}
            accessibilityLabel={isUsed ? `${f.name}, 사용 중` : f.name}
          >
            <View style={[styles.ic, on && styles.icOn, isUsed && styles.dim]}>
              <SvgXml xml={fruitXml(f.svg, on ? color.accent : color.fg)} width={IC_SVG} height={IC_SVG} />
            </View>
            <Text style={[styles.name, on && styles.nameOn, isUsed && styles.dim]}>{f.name}</Text>
            <Text style={styles.used}>{isUsed ? '사용 중' : ''}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const IC = Platform.OS === 'ios' ? 52 : 46
const IC_SVG = Platform.OS === 'ios' ? 28 : 25

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Platform.OS === 'ios' ? 10 : 6 },
  fruit: { width: '33.33%', paddingVertical: 4, alignItems: 'center', gap: 4 },
  ic: {
    width: IC,
    height: IC,
    borderRadius: IC / 2,
    backgroundColor: color.card,
    boxShadow: '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icOn: { backgroundColor: color.ink },
  dim: { opacity: 0.4 },
  name: { fontFamily: font.semiBold, fontSize: 16, color: color['fg-2'] },
  nameOn: { fontFamily: font.bold, color: color.fg },
  used: { minHeight: 16, fontFamily: font.regular, fontSize: 13, color: color.muted },
})
