import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { balance, bySentence, keepAll, OB_EDGES } from '@/components/ObScreen';
import { font } from '@/theme/tokens';

interface Props {
  ssid: string;
}

export default function BedWifiConnectingScreen({ ssid }: Props) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <View style={styles.center}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        <Text style={styles.title}>{keepAll(balance('침대가 공유기 와이파이에 연결하고 있어요'))}</Text>
        <Text style={styles.subtitle}>
          {keepAll(bySentence(`침대가 ${ssid}에 연결하면 폰도 원래 와이파이로 돌아가요. 1분쯤 걸릴 수 있어요.`))}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  // 시안 .ob 안쪽 여백(위 16, 아래 아이폰 40·갤럭시 16) 안에서 가운데
  center: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  spinner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#342724',
    borderRightColor: 'transparent',
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontFamily: font.bold,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    color: '#2D2220',
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 25.5,
    color: '#513E39',
    textAlign: 'center',
  },
});