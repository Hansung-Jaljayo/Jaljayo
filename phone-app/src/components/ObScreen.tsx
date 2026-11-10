import { type ReactNode } from 'react'
import { ActivityIndicator, Dimensions, Image, type ImageSourcePropType, Platform, StyleSheet, Text, View } from 'react-native'
import { type Edge, SafeAreaView } from 'react-native-safe-area-context'

import { color, font } from '@/theme/tokens'
import { RippleButton } from './RippleButton'
import { PullScroll } from './PullScroll'

// 시안 .ob: 아이폰은 화면 아래 끝에서 40(홈 막대 자리를 따로 비우지 않는다). 갤럭시는 내비게이션 막대 위 16
export const OB_EDGES: Edge[] | undefined = Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined

// 시안처럼 한글이 낱말 중간에서 줄바꿈되지 않게(안드로이드는 글자 단위로 자른다) 낱말 안 글자 사이에 줄 안 바꿈 표시를 넣는다
// 시안 text-wrap: pretty처럼 문단 마지막 낱말이 혼자 한 줄에 남지 않게 마지막 띄어쓰기를 붙는 띄어쓰기로 바꾼다
const pretty = (t: string) => t.split('\n').map((l) => l.replace(/ (?=\S+\s*$)/, '\u00A0')).join('\n')
export const keepAll = (t: string) => pretty(t).replace(/([^\s])(?=[^\s])/g, '$1\u2060')
// 시안의 안내 글처럼 문장마다 줄을 나눈다
export const bySentence = (t: string) => t.replace(/([.?!])\s+/g, '$1\n')

// 한글 낱말을 자르지 않는 글자(문자열 자식만 바꾼다)
export function Ko({ children, ...rest }: React.ComponentProps<typeof Text>) {
  const fix = (c: React.ReactNode): React.ReactNode => (typeof c === 'string' ? keepAll(c) : c)
  return <Text {...rest}>{Array.isArray(children) ? children.map(fix) : fix(children)}</Text>
}

// 시안의 제목처럼(text-wrap: balance) 두 줄이 되는 제목은 가운데 가까운 띄어쓰기에서 나눠 두 줄 길이를 고르게 한다.
// 폭은 어림: 한글 한 글자 0.92배(굵은 제목), 띄어쓰기 0.28배, 그 밖 0.6배(글자 크기 기준)
export const TITLE_SIZE = Platform.OS === 'ios' ? 30 : 24
const textWidth = (t: string, size: number) =>
  [...t].reduce((w, ch) => w + size * (ch === ' ' ? 0.28 : /[가-힣]/.test(ch) ? 0.92 : 0.6), 0)
export function balance(t: string, fontSize = TITLE_SIZE, width = Dimensions.get('window').width - 36) {
  if (t.includes('\n') || textWidth(t, fontSize) <= width) return t
  let best = -1
  let bestDiff = Infinity
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== ' ') continue
    const a = textWidth(t.slice(0, i), fontSize)
    const b = textWidth(t.slice(i + 1), fontSize)
    if (a > width || b > width) continue
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b)
      best = i
    }
  }
  return best < 0 ? t : `${t.slice(0, best)}\n${t.slice(best + 1)}`
}

// 밑줄 링크 글자. 안드로이드는 글자 밑줄이 그려지지 않아 글자 아래에 얇은 선을 직접 긋는다
export function LinkText({ style, children, ...rest }: React.ComponentProps<typeof Text>) {
  if (Platform.OS !== 'android') return <Text style={style} {...rest}>{children}</Text>
  const flat = StyleSheet.flatten(style) || {}
  return (
    <View style={{ borderBottomWidth: 1.5, borderBottomColor: (flat.color as string) || color['fg-2'], paddingBottom: 1 }}>
      <Text style={[style, { textDecorationLine: 'none' }]} {...rest}>
        {children}
      </Text>
    </View>
  )
}

export type ObButton = { label: string; onPress?: () => void; disabled?: boolean; warn?: boolean }

type Props = {
  title: string
  lead?: string
  // 가운데 정렬 화면(아이콘 + 제목 + 설명, 오류·완료 화면). 없으면 위에서부터 쌓는 입력 화면
  icon?: ImageSourcePropType
  spinner?: boolean
  bad?: boolean
  children?: ReactNode
  primary?: ObButton
  secondary?: ObButton
  links?: ObButton[]
  // 시안 이름 고르기처럼 버튼을 아래 끝에 붙이지 않고 내용 바로 아래(16)에 둔다
  flow?: boolean
}

// 등록·병원 관리 화면의 공통 틀. 기존 등록 화면(BedNotFoundScreen 등)과 같은 글자·버튼 모양을 쓴다
export function ObScreen({ title, lead, icon, spinner, bad, children, primary, secondary, links, flow }: Props) {
  const centered = !!icon || !!spinner
  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <PullScroll
        contentContainerStyle={[styles.body, centered && styles.bodyCenter, flow && styles.bodyFlow]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.top, centered && styles.topCenter]}>
          {icon && (
            <View style={[styles.iconBox, bad && styles.iconBad]}>
              <Image source={icon} style={styles.iconImage} resizeMode="contain" />
            </View>
          )}
          {spinner && <ActivityIndicator size="large" color={color['accent-strong']} style={styles.spinner} />}
          <Text style={[styles.title, centered && styles.textCenter]} role="heading">
            {keepAll(balance(title))}
          </Text>
          {!!lead && <Text style={[styles.lead, centered && styles.textCenter]}>{keepAll(bySentence(lead))}</Text>}
          {children}
        </View>

        {(primary || secondary || links?.length) && (
          <View style={styles.actions}>
            {primary && (
              <RippleButton rippleColor="#FFFAF7"
                style={[styles.primary, primary.warn && styles.primaryWarn, primary.disabled && styles.primaryOff]}
                onPress={primary.onPress}
                disabled={primary.disabled}
              >
                <Text style={styles.primaryText}>{primary.label}</Text>
              </RippleButton>
            )}
            {secondary && (
              <RippleButton
                style={styles.secondary}
                onPress={secondary.onPress}
                disabled={secondary.disabled}
              >
                <Text style={[styles.secondaryText, secondary.warn && styles.warnText, secondary.disabled && styles.secondaryOffText]}>
                  {secondary.label}
                </Text>
              </RippleButton>
            )}
            {!!links?.length && (
              <View style={styles.links}>
                {links.map((l) => (
                  <RippleButton key={l.label} style={styles.link} rippleColor={color['fg-2']} onPress={l.onPress} disabled={l.disabled}>
                    <LinkText style={styles.linkText}>{l.label}</LinkText>
                  </RippleButton>
                ))}
              </View>
            )}
          </View>
        )}
      </PullScroll>
    </SafeAreaView>
  )
}

export const obStyles = StyleSheet.create({
  // 안내 상자(시안 .ninfo): 연한 바탕 글
  note: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: color.inset,
    fontFamily: font.semiBold,
    fontSize: 15,
    lineHeight: 22.5,
    color: color['fg-2'],
  },
  // 경고 상자(시안 .note): 붉은 바탕 글
  noteBad: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: color.warnBg,
    fontFamily: font.semiBold,
    fontSize: 15,
    lineHeight: 22.5,
    color: color.red,
  },
  // 입력 칸 아래 틀렸다는 한 줄
  err: { fontFamily: font.semiBold, fontSize: 15, color: color.red },
  // 요약 한 줄(시안 .nsum)
  sum: { fontFamily: font.semiBold, fontSize: 15, color: color['fg-2'] },
  // 소제목(시안 .asec)
  sec: { marginTop: 6, marginBottom: -6, fontFamily: font.bold, fontSize: 15, color: color.muted },
  // 흰 목록 카드(시안 .wlist·.ncard)
  card: { backgroundColor: color.card, borderRadius: 22, overflow: 'hidden', boxShadow: '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)' },
  cardSmall: { borderRadius: 20 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 12,
  },
  // 스위치 줄(시안 .nrow)
  switchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: color.inset },
  rowTitle: { fontFamily: font.semiBold, fontSize: 17, color: color.fg },
  rowTitleBold: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  rowSub: { marginTop: 2, fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: color.muted },
  chevron: { marginLeft: 'auto', fontSize: 22, color: color.muted },
  // 입력 칸(시안 .field)
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: color.card,
    paddingHorizontal: 16,
    fontFamily: font.regular,
    fontSize: 17,
    color: color.fg,
    borderWidth: 2,
    borderColor: color.line,
  },
  inputBad: { borderColor: color.red },
  label: { fontFamily: font.bold, fontSize: 15, color: color['fg-2'] },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  body: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    gap: 16,
    justifyContent: 'space-between',
  },
  bodyCenter: { justifyContent: 'center' },
  bodyFlow: { justifyContent: 'flex-start' },
  top: { gap: 12 },
  topCenter: { alignItems: 'center', gap: 14, flexGrow: 1, justifyContent: 'center' },
  // 시안 .icon: 흰 동그라미. 문제가 생긴 화면(.bad)은 분홍 동그라미
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: color.card,
    boxShadow: '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBad: { backgroundColor: color.accent, boxShadow: 'none' },
  iconImage: { width: 44, height: 44 },
  spinner: { marginBottom: 8, transform: [{ scale: 1.4 }] },
  // 아이폰 30, 갤럭시 24
  title: {
    fontFamily: font.bold,
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
    color: color.fg,
  },
  lead: { fontFamily: font.regular, fontSize: 17, lineHeight: 25.5, color: color['fg-2'] },
  textCenter: { textAlign: 'center' },
  actions: { gap: 8 },
  primary: {
    height: 60,
    backgroundColor: color.ink,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryWarn: { backgroundColor: color.red },
  primaryText: { fontFamily: font.bold, fontSize: 20, color: color['on-ink'] },
  secondary: {
    height: 56,
    backgroundColor: color.card,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px 0px rgba(52, 39, 36, 0.06), 0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
  },
  secondaryText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  warnText: { color: color.red },
  // 시안: 막힌 큰 버튼은 연한 바탕·흰 글자, 막힌 흰 버튼은 글자만 흐리게
  primaryOff: { backgroundColor: color.switchOff },
  secondaryOffText: { color: '#b3a6a1' },
  links: { flexDirection: 'row', justifyContent: 'center', height: 48, alignItems: 'center', gap: 8 },
  link: { paddingHorizontal: 6, paddingVertical: 1 },
  linkText: { fontFamily: font.bold, fontSize: 17, textDecorationLine: 'underline', color: color['fg-2'] },
})
