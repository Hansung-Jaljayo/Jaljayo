import { type ReactNode } from 'react'
import { ActivityIndicator, Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { color, font } from '@/theme/tokens'

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
}

// 등록·병원 관리 화면의 공통 틀. 기존 등록 화면(BedNotFoundScreen 등)과 같은 글자·버튼 모양을 쓴다
export function ObScreen({ title, lead, icon, spinner, bad, children, primary, secondary, links }: Props) {
  const centered = !!icon || !!spinner
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.body, centered && styles.bodyCenter]}
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
            {title}
          </Text>
          {!!lead && <Text style={[styles.lead, centered && styles.textCenter]}>{lead}</Text>}
          {children}
        </View>

        {(primary || secondary || links?.length) && (
          <View style={styles.actions}>
            {primary && (
              <TouchableOpacity
                style={[styles.primary, primary.warn && styles.primaryWarn, primary.disabled && styles.disabled]}
                onPress={primary.onPress}
                disabled={primary.disabled}
              >
                <Text style={styles.primaryText}>{primary.label}</Text>
              </TouchableOpacity>
            )}
            {secondary && (
              <TouchableOpacity
                style={[styles.secondary, secondary.disabled && styles.disabled]}
                onPress={secondary.onPress}
                disabled={secondary.disabled}
              >
                <Text style={[styles.secondaryText, secondary.warn && styles.warnText]}>{secondary.label}</Text>
              </TouchableOpacity>
            )}
            {!!links?.length && (
              <View style={styles.links}>
                {links.map((l) => (
                  <TouchableOpacity key={l.label} style={styles.link} onPress={l.onPress} disabled={l.disabled}>
                    <Text style={styles.linkText}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

export const obStyles = StyleSheet.create({
  // 입력 칸 아래 한 줄 안내
  note: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: color.muted },
  noteBad: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 22, color: color.red },
  // 소제목
  sec: { marginTop: 8, fontFamily: font.bold, fontSize: 15, color: color.muted },
  // 흰 카드
  card: { backgroundColor: color.card, borderRadius: 22, overflow: 'hidden', boxShadow: '0px 12px 32px -8px rgba(52, 39, 36, 0.16)' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },
  rowLine: { borderTopWidth: 1, borderTopColor: color.inset },
  rowTitle: { fontFamily: font.semiBold, fontSize: 17, color: color.fg },
  rowSub: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, color: color.muted },
  chevron: { marginLeft: 'auto', fontSize: 20, color: color.muted },
  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: color.card,
    paddingHorizontal: 16,
    fontFamily: font.medium,
    fontSize: 18,
    color: color.fg,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  inputBad: { borderColor: color.red },
  label: { fontFamily: font.semiBold, fontSize: 15, color: color['fg-2'] },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  body: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16, gap: 16, justifyContent: 'space-between' },
  bodyCenter: { justifyContent: 'center' },
  top: { gap: 12 },
  topCenter: { alignItems: 'center', gap: 14, flexGrow: 1, justifyContent: 'center' },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBad: { backgroundColor: color.warnBg },
  iconImage: { width: 56, height: 56 },
  spinner: { marginBottom: 8, transform: [{ scale: 1.4 }] },
  title: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.72, lineHeight: 30, color: color.fg },
  lead: { fontFamily: font.regular, fontSize: 17, lineHeight: 26, color: color['fg-2'] },
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
    boxShadow: '0px 12px 32px -8px rgba(52, 39, 36, 0.16)',
  },
  secondaryText: { fontFamily: font.bold, fontSize: 17, color: color.fg },
  warnText: { color: color.red },
  disabled: { opacity: 0.45 },
  links: { flexDirection: 'row', justifyContent: 'center', height: 48, alignItems: 'center', gap: 8 },
  link: { paddingHorizontal: 6, paddingVertical: 1 },
  linkText: { fontFamily: font.bold, fontSize: 17, textDecorationLine: 'underline', color: color['fg-2'] },
})
