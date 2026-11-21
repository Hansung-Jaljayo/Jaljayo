import { Image, StyleSheet, View } from 'react-native';

// 시작 화면(시안 .splash): 앱 아이콘과 같은 크림색 바탕에 바탕 없는 침대 그림 128만
export default function StartScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/bed-logo.png')} style={styles.bed} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bed: {
    width: 128,
    height: 128,
  },
});
