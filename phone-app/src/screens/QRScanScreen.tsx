import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { balance, bySentence, keepAll, LinkText } from '@/components/ObScreen';
import { font } from '@/theme/tokens';

interface Props {
  // 잘자요 침대 QR을 읽었을 때(한 번만 부른다)
  onScanned?: (data: string) => void;
  // 카메라 권한을 다시 물을 수 없게 거부된 상태
  onDenied?: () => void;
  onSettings?: () => void;
}

// 개발 빌드에서 카메라 칸을 길게 누르면 찍은 것처럼 넘어간다(시뮬레이터에는 카메라가 없다)
const DEV_QR = 'jaljayo://bed/1';

export default function QRScanScreen({ onScanned, onDenied, onSettings }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showWhere, setShowWhere] = useState(false);
  const [wrongQR, setWrongQR] = useState(false);
  // 카메라는 같은 QR을 1초에 여러 번 알려 준다. 처음 한 번만 넘긴다
  const done = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted) return;
    if (permission.canAskAgain) requestPermission();
    else onDenied?.();
  }, [permission, requestPermission, onDenied]);

  const handleScanned = (data: string) => {
    if (done.current) return;
    if (data.startsWith('jaljayo://')) {
      done.current = true;
      setWrongQR(false);
      onScanned?.(data);
    } else {
      setWrongQR(true);
      setShowWhere(false);
    }
  };

  if (!permission || !permission.granted) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{keepAll(balance('침대 등록'))}</Text>
      <Text style={styles.description}>{keepAll(bySentence('침대 모듈에 붙은 QR 코드를 네모 안에 비춰 주세요'))}</Text>

      <View style={styles.fill}>
        <Pressable
          style={styles.cameraBox}
          onLongPress={__DEV__ ? () => handleScanned(DEV_QR) : undefined}
          accessibilityLabel="QR 코드 찍기"
        >
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(result) => handleScanned(result.data)}
          />
          {/* 모서리 */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </Pressable>
      </View>

      {wrongQR && (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            {'잘자요 침대 QR이 아니에요. 침대 모듈 윗면의 QR을 찍어 주세요.'}
          </Text>
        </View>
      )}

      {showWhere && (
        <View style={styles.whereCard}>
          <View style={styles.whereIconBox}>
            <View style={styles.whereQrDash}>
              {/* QR 코드 모형 */}
              <View style={styles.qrInner}>
                {/* 왼쪽 위 모서리 */}
                <View style={[styles.qrCorner, { top: 0, left: 0 }]}>
                  <View style={styles.qrCornerDot} />
                </View>
                {/* 오른쪽 위 모서리 */}
                <View style={[styles.qrCorner, { top: 0, right: 0 }]}>
                  <View style={styles.qrCornerDot} />
                </View>
                {/* 왼쪽 아래 모서리 */}
                <View style={[styles.qrCorner, { bottom: 0, left: 0 }]}>
                  <View style={styles.qrCornerDot} />
                </View>
                {/* 가운데 점들 */}
                <View style={styles.qrDots}>
                  {[0,1,2,3,4].map(i => (
                    <View key={i} style={styles.qrDot} />
                  ))}
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.whereText}>QR 코드는 침대 모듈 윗면에 붙어 있어요.</Text>
        </View>
      )}

      <View style={styles.links}>
        <TouchableOpacity style={styles.link} onPress={() => { setShowWhere(!showWhere); setWrongQR(false); }}>
          <LinkText style={styles.linkText}>{showWhere ? '접기' : 'QR 코드가 안 보여요'}</LinkText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={onSettings}>
          <LinkText style={styles.linkText}>설정</LinkText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    gap: 16,
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontFamily: font.bold,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    color: '#2D2220',
    lineHeight: Platform.OS === 'ios' ? 36 : 30,
  },
  description: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 26,
    color: '#513E39',
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBox: {
    width: Platform.OS === 'ios' ? 300 : 250,
    height: Platform.OS === 'ios' ? 300 : 250,
    backgroundColor: '#1D1614',
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: '#FFFFFF',
    borderWidth: 4,
  },
  cornerTL: {
    top: 40,
    left: 40,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 40,
    right: 40,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 40,
    left: 40,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 40,
    right: 40,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  link: {
    paddingVertical: 1,
    paddingHorizontal: 6,
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
  noteCard: {
    width: '100%',
    backgroundColor: '#F6E2DB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteText: {
    fontSize: 15,
    fontFamily: font.semiBold,
    lineHeight: 22,
    color: '#AD332C',
  },
  whereCard: {
    width: '100%',
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
    alignItems: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  whereIconBox: {
    width: 150,
    height: 75,
    backgroundColor: '#342724',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whereQrDash: {
    width: 44,
    height: 44,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#FFD3C2',
    borderRadius: 6,
    padding: 4,
  },
  qrInner: {
    flex: 1,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCornerDot: {
    width: 5,
    height: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  qrDots: {
    position: 'absolute',
    top: 4,
    left: 14,
    right: 14,
    bottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    alignContent: 'center',
    justifyContent: 'center',
  },
  qrDot: {
    width: 4,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    opacity: 0.8,
  },
  whereText: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 26,
    textAlign: 'center',
    color: '#2D2220',
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#D4806A',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontFamily: font.semiBold,
    fontSize: 15,
  },
});