import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  onRetry?: () => void;
  onSettings?: () => void;
}

export default function DisconnectedByOtherPhoneScreen({ onRetry, onSettings }: Props) {
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

          <Text style={styles.title}>{'다른 폰에 등록되어\n조작할 수 없어요'}</Text>

          <Text style={styles.description}>
            {'이 폰으로 다시 쓰려면 침대 QR을 다시\n찍어 등록하세요.'}
          </Text>
        </View>

        {/* 버튼 묶음 */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryText}>다시 확인</Text>
          </TouchableOpacity>

          <View style={styles.links}>
            <TouchableOpacity style={styles.link} onPress={onSettings}>
              <Text style={styles.linkText}>설정</Text>
            </TouchableOpacity>
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
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: '#513E39',
    lineHeight: 20,
  },
});