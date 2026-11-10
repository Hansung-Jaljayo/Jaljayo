import { Image, StyleSheet, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { balance, bySentence, keepAll, LinkText, OB_EDGES } from '@/components/ObScreen';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';

interface Props {
  onRetry?: () => void;
  onSettings?: () => void;
}

export default function AppUpdateScreen({ onRetry, onSettings }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <View style={styles.fill}>
        <View style={styles.center}>
          <View style={styles.iconBox}>
            <Image
              source={require('../../assets/images/update.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>{keepAll(balance('앱을 업데이트해 주세요'))}</Text>

          <Text style={styles.description}>{keepAll(bySentence('이 침대를 쓰려면 새 버전의 잘자요 앱이 필요해요.'))}</Text>
        </View>

        <View style={styles.actions}>
          <RippleButton rippleColor="#FFFAF7" style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryText}>스토어 열기</Text>
          </RippleButton>

          <View style={styles.links}>
            <RippleButton style={styles.link} rippleColor="#513E39" onPress={onSettings}>
              <LinkText style={styles.linkText}>설정</LinkText>
            </RippleButton>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  fill: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFCFA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  iconImage: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontFamily: font.bold,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    color: '#2D2220',
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
  },
  description: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 25.5,
    color: '#513E39',
    textAlign: 'center',
  },
  actions: {
    gap: 8,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#342724',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 20,
    fontFamily: font.bold,
    color: '#FFFAF7',
    lineHeight: 24,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: 48,
    alignItems: 'center',
  },
  link: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  linkText: {
    fontSize: 17,
    fontFamily: font.bold,
    textDecorationLine: 'underline',
    color: '#513E39',
    lineHeight: 20,
  },
});