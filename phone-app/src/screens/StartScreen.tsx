import { Image, StyleSheet, View } from 'react-native';

export default function StartScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/bed.png')}
        style={styles.bed}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bed: {
    width: 280,
    height: 280,
  },
});