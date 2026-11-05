import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  description?: string;
  onStart?: () => void;
}

export default function RegisterSuccessScreen({
  description = '이제 이 폰으로 침대를 움직일 수 있어요.',
  onStart,
}: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fill}>
        <View style={styles.center}>
          {/* 아이콘 */}
          <View style={styles.iconBox}>
            <Image
              source={require('../../assets/images/check.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>등록됐어요</Text>

          <Text style={styles.description}>{description}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
          <Text style={styles.primaryText}>시작하기</Text>
        </TouchableOpacity>
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
    backgroundColor: '#342724',
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
});