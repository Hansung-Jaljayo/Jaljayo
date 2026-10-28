import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { color, font, space } from '@/theme/tokens'

import { RippleButton } from './RippleButton'

export type Option<T> = { value: T; name: string; sub?: string }

type Props<T> = {
  // 묶음 이름(읽어 주기용)
  label: string
  options: Option<T>[]
  value: T
  onPick: (value: T) => void
}

// rin · 펼친 칸의 고르는 칸들(ropt): 하나만 고른다. 고른 칸은 이름을 굵게, 오른쪽에 복숭아색 체크
export function OptionRows<T extends string | number>({ label, options, value, onPick }: Props<T>) {
  return (
    <View style={styles.rin} role="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <RippleButton
            key={o.value}
            style={styles.opt}
            role="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onPick(o.value)}
          >
            <View style={styles.text}>
              <Text style={[styles.name, on && styles.nameOn]}>{o.name}</Text>
              {o.sub ? <Text style={styles.sub}>{o.sub}</Text> : null}
            </View>
            {/* 고르지 않은 칸도 같은 자리를 비워 둔다 */}
            <Image
              source={require('../../assets/icons/check-accent.svg')}
              style={[styles.icon22, !on && styles.hidden]}
            />
          </RippleButton>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  rin: { gap: space[4] },
  opt: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingLeft: space[16],
    paddingRight: 20,
  },
  text: { flex: 1, gap: space[2] },
  name: { fontFamily: font.medium, fontSize: 17, color: color.fg },
  nameOn: { fontFamily: font.bold },
  sub: { fontFamily: font.regular, fontSize: 15, color: color.muted },
  icon22: { width: 22, height: 22 },
  hidden: { opacity: 0 },
})
