import { Image } from 'expo-image';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { balance, bySentence, keepAll, LinkText, OB_EDGES } from '@/components/ObScreen';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';

interface Props {
  networks: string[];
  onSelect?: (ssid: string) => void;
  onRescan?: () => void;
  // 다시 찾는 중이면 링크가 "찾는 중…"으로 바뀌고 막힌다
  scanning?: boolean;
  onHome?: () => void;
}

export default function WifiSelectScreen({ networks, onSelect, onRescan, scanning, onHome }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title}>{keepAll(balance('와이파이를 골라 주세요'))}</Text>
          <Text style={styles.lead}>{keepAll(bySentence('침대가 앞으로 연결할 와이파이예요.'))}</Text>

          {networks.length === 0 ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                {'주변 와이파이를 찾지 못했어요. 공유기 전원이\n켜져 있는지 확인해 주세요.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {networks.map((ssid, index) => (
                <RippleButton
                  key={ssid}
                  style={[styles.listItem, index < networks.length - 1 && styles.listItemBorder]}
                  onPress={() => onSelect?.(ssid)}
                >
                  <Text style={styles.ssid}>{ssid}</Text>
                  <Image source={require('../../assets/icons/chevron.svg')} style={styles.chevron} />
                </RippleButton>
              ))}
            </View>
          )}

          <View style={styles.links}>
            <RippleButton style={styles.link} rippleColor="#513E39" onPress={onRescan} disabled={scanning}>
              <LinkText style={styles.linkText}>{scanning ? '찾는 중…' : '다시 찾기'}</LinkText>
            </RippleButton>
          </View>
        </View>

        <RippleButton style={styles.secondaryButton} onPress={onHome}>
          <Text style={styles.secondaryText}>취소</Text>
        </RippleButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    justifyContent: 'space-between',
  },
  top: {
    gap: 16,
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontFamily: font.bold,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    color: '#2D2220',
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
  },
  lead: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 25.5,
    color: '#513E39',
  },
  list: {
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 18,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
  },
  ssid: {
    fontSize: 17,
    fontFamily: font.semiBold,
    color: '#2D2220',
    lineHeight: 20,
  },
  chevron: {
    width: 20,
    height: 20,
  },
  note: {
    backgroundColor: '#F6E2DB',
    borderRadius: 16,
    padding: 14,
    paddingVertical: 12,
  },
  noteText: {
    fontSize: 15,
    fontFamily: font.semiBold,
    lineHeight: 22,
    color: '#AD332C',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  link: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    height: 48,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 17,
    fontFamily: font.bold,
    textDecorationLine: 'underline',
    color: '#513E39',
    lineHeight: 20,
  },
  secondaryButton: {
    height: 56,
    backgroundColor: '#FFFCFA',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  secondaryText: {
    fontSize: 17,
    fontFamily: font.bold,
    color: '#2D2220',
    lineHeight: 20,
  },
});