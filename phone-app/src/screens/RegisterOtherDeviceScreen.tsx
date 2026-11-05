import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  description: string;
  onRetry?: () => void;
  onHome?: () => void;
}

export default function RegisterOtherDeviceScreen({ description, onRetry, onHome }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fill}>
        <View style={styles.center}>
          {/* 아이콘 */}
          <View style={styles.iconBox}>
            <Image
              source={require('../../assets/images/other-phone.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>다른 폰에 등록된 침대예요</Text>

          <Text style={styles.description}>{description}</Text>
        </View>

        {/* 버튼 묶음 */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryText}>다시 확인</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onHome}>
            <Text style={styles.secondaryText}>처음으로</Text>
          </TouchableOpacity>
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
    gap: 16,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ECB0A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.72,
    color: '#2D2220',
    textAlign: 'center',
    lineHeight: 30,
  },
  description: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
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
    fontWeight: '700',
    color: '#FFFAF7',
    lineHeight: 24,
  },
  secondaryButton: {
    width: '100%',
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
    fontWeight: '700',
    color: '#2D2220',
    lineHeight: 20,
  },
});