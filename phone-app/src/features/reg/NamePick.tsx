import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import { Ko, ObScreen, obStyles } from '@/components/ObScreen'
import { useRipple } from '@/components/RippleButton'
import { useInnerBack } from '@/features/app/flow'
import { setBedInfo, useBedInfo } from '@/features/bed/bed'
import { saveRegisteredBed } from '@/features/bed/boardLink'
import { useBedRequest } from '@/features/bed/useBedRequest'
import { FRUITS, fruitXml, getHospital, reasonOf, setHospital, useHospital } from '@/features/hospital/hospital'
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
// 같은 병실에서 쓰는 이름(bed-register 답의 used)은 고를 수 없다. 이름은 침대에 저장하므로 침대가 답할 때 정해진다(name-save)
export function NamePick({ renaming, preset = '', onDone, onCancel }: Props) {
  const bed = useBedInfo()
  const hosp = useHospital()
  const current = bed.ward?.name ?? ''
  const [pick, setPick] = useState(renaming ? current : preset)
  // 침대가 거절한 이유(예: 같은 병실에서 이미 쓰는 이름이에요)
  const [refused, setRefused] = useState('')
  const r = useBedRequest()
  // 이 침대가 쓰던 이름은 다시 고를 수 있게 뺀다
  const used = (hosp.mine?.used ?? []).filter((n) => n !== current)
  const blocked = !bed.connected || bed.loading
  const pending = r.waiting
  const waiting = r.waiting && !r.timedOut
  // 저장 중에는 뒤로도 막는다(취소 버튼도 막혀 있다)
  useInnerBack(() => waiting)

  const save = () => {
    if (blocked || !pick || waiting) return
    if (r.timedOut) return r.retry()
    const selected = pick
    setRefused('')
    r.send({ type: 'name-save', body: { name: selected } }, (reply) => {
      // 그사이 같은 병실의 다른 침대가 먼저 이 이름을 썼으면 침대가 거절한다. 그 이름은 사용 중으로 막는다
      if (reply.ok === false) {
        setPick('')
        setRefused(reasonOf(reply, '이 이름으로 정하지 못했어요. 다른 이름을 골라 주세요.'))
        const mine = getHospital().mine
        if (mine && !mine.used.includes(selected)) setHospital({ mine: { ...mine, used: [...mine.used, selected] } })
        return
      }
      if (bed.ward) setBedInfo({ ward: { ...bed.ward, name: selected } })
      // 11/19: 병실 QR로 등록하면 고른 이름에 따라 침대가 정해진다. 보드가 알려 준 침대 번호를 저장해 다음에 켤 때 그 침대로 붙는다
      if (typeof reply.id === 'string') {
        saveRegisteredBed(reply.id)
        const m = getHospital().mine
        if (m) setHospital({ mine: { ...m, id: reply.id } })
      }
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
      flow
      primary={{
        label,
        onPress: save,
        disabled: blocked || waiting || !pick || (!pending && renaming && pick === current),
      }}
      // 시안: 취소는 이름을 바꿀 때나 저장을 기다릴 때만 보인다(처음 등록할 때는 이름을 꼭 정한다)
      secondary={renaming || pending ? {
        label: '취소',
        onPress: () => {
          if (waiting) return
          r.cancel()
          onCancel()
        },
        disabled: waiting,
      } : undefined}
    >
      <FruitGrid label="부르는 이름" value={pick} used={used} disabled={pending} onPick={setPick} />
      {(blocked || r.timedOut || !!refused) && (
        <Ko style={obStyles.noteBad} role="status">
          {blocked
            ? '침대와 연결되어 정보를 확인한 뒤 저장할 수 있어요.'
            : refused
              ? refused
              : '저장 결과를 확인하지 못했어요. 다시 시도하거나 기다리기를 취소해 주세요.'}
        </Ko>
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
          <FruitButton
            key={f.name}
            on={on}
            onPress={() => !disabled && onPick(f.name)}
            disabled={isUsed || !!disabled}
            accessibilityLabel={isUsed ? `${f.name}, 사용 중` : f.name}
          >
            <View style={[styles.ic, on && styles.icOn, isUsed && styles.dim]}>
              <SvgXml xml={fruitXml(f.svg, on ? color.accent : color.fg)} width={IC_SVG} height={IC_SVG} />
            </View>
            <Text style={[styles.name, on && styles.nameOn, isUsed && styles.dim]}>{f.name}</Text>
            <Text style={styles.used}>{isUsed ? '사용 중' : ''}</Text>
          </FruitButton>
        )
      })}
    </View>
  )
}

// 과일 버튼 한 칸: 누르면 칸 전체(모서리 16)에 물결이 퍼진다(시안 .ob .fruits button)
function FruitButton({
  on,
  onPress,
  disabled,
  accessibilityLabel,
  children,
}: {
  on: boolean
  onPress: () => void
  disabled: boolean
  accessibilityLabel: string
  children: React.ReactNode
}) {
  const { host, onLayout, start, end, layer } = useRipple(on ? color.fg : color['fg-2'], FRUIT_RADIUS)
  return (
    <Pressable
      ref={host}
      onLayout={onLayout}
      style={styles.fruit}
      onPress={onPress}
      onPressIn={start}
      onPressOut={end}
      disabled={disabled}
      role="radio"
      aria-checked={on}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
      {layer}
    </Pressable>
  )
}

const FRUIT_RADIUS = { borderRadius: 16 }
const IC = Platform.OS === 'ios' ? 52 : 46
const IC_SVG = Platform.OS === 'ios' ? 28 : 25

const styles = StyleSheet.create({
  // 세 칸 사이 8(시안 gap: 10px 8px, 갤럭시 6px 8px)
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Platform.OS === 'ios' ? 10 : 6, columnGap: 8 },
  fruit: { flexBasis: '30%', flexGrow: 1, paddingVertical: 4, alignItems: 'center', gap: 4, borderRadius: 16 },
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
