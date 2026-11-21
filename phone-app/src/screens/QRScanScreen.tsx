import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { balance, bySentence, keepAll, LinkText, OB_EDGES } from '@/components/ObScreen';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';
import { InputDialog } from '@/components/InputDialog';

interface Props {
  // 잘자요 침대 QR을 읽었을 때(한 번만 부른다)
  onScanned?: (data: string) => void;
  // 11/19부터 부르지 않는다(카메라를 거부해도 이 화면에서 고유 번호로 넣을 수 있음). 부르는 쪽 호환으로만 남김
  onDenied?: () => void;
  onSettings?: () => void;
  // 병원 관리의 침대 추가처럼 다른 글로 쓸 때
  title?: string;
  description?: string;
  // 있으면 아래에 "취소" 글자 버튼을 둔다
  onCancel?: () => void;
  // 11/19: QR을 읽고 침대를 찾는 중(화면은 그대로 두고 안내만 띄운다)
  finding?: boolean;
}

// 개발 빌드에서 카메라 칸을 길게 누르면 찍은 것처럼 넘어간다(시뮬레이터에는 카메라가 없다)
export const DEV_QR = 'jaljayo://bed/DEV1-1';
// 개발용: 시험 도구가 "QR을 읽은 것처럼" 부른다(지금 QR 화면이 떠 있을 때만 들어 있다)
export const qrScanDev: { current: ((data: string) => void) | null } = { current: null };

export default function QRScanScreen({ onScanned, onSettings, title = '침대 등록', description = '침대 모듈에 붙은 QR 코드를 네모 안에 비춰 주세요.', onCancel, finding = false }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showWhere, setShowWhere] = useState(false);
  const [wrongQR, setWrongQR] = useState(false);
  // 고유 번호를 글자로 넣는 창(카메라가 없거나 QR을 비추기 어려울 때. 노트북 에뮬레이터도 이 길로 넣는다)
  const [typing, setTyping] = useState(false);
  const [badId, setBadId] = useState(false);
  // 카메라는 같은 QR을 1초에 여러 번 알려 준다. 처음 한 번만 넘긴다
  const done = useRef(false);

  // 11/19: 카메라를 허용하지 않아도 이 화면에 머문다(카메라 칸에 안내, 아래 "고유 번호로 입력"은 그대로 쓸 수 있음).
  // 카메라가 없는 노트북 에뮬레이터에서도 고유 번호로 넘어갈 수 있게
  useEffect(() => {
    if (!permission || permission.granted) return;
    if (permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);
  const camOk = !!permission?.granted;
  const camDenied = !!permission && !permission.granted && !permission.canAskAgain;

  const handleScanned = (data: string) => {
    if (done.current) return;
    if (data.startsWith('jaljayo://')) {
      done.current = true;
      setWrongQR(false);
      setBadId(false);
      // 읽은 순간 진동으로 알린다(침대를 찾는 동안 화면이 그대로라 읽혔는지 알 수 있게)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onScanned?.(data);
    } else {
      setWrongQR(true);
      setBadId(false);
      setShowWhere(false);
    }
  };

  useEffect(() => {
    qrScanDev.current = handleScanned;
    return () => {
      qrScanDev.current = null;
    };
  });

  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <Text style={styles.title}>{keepAll(balance(title))}</Text>
      <Text style={styles.description}>{keepAll(bySentence(description))}</Text>

      <View style={styles.fill}>
        <Pressable
          style={styles.cameraBox}
          onLongPress={__DEV__ ? () => handleScanned(DEV_QR) : undefined}
          accessibilityLabel="QR 코드 찍기"
        >
          {camOk ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result) => handleScanned(result.data)}
            />
          ) : (
            <View style={styles.noCam}>
              <Text style={styles.noCamText}>
                {keepAll(camDenied ? '카메라를 허용하지 않아 QR을 찍을 수 없어요. 아래 고유 번호로 입력을 써 주세요.' : '카메라를 준비하고 있어요')}
              </Text>
              {camDenied && (
                <RippleButton style={styles.noCamBtn} rippleColor="#FFFAF7" onPress={() => Linking.openSettings()}>
                  <Text style={styles.noCamBtnText}>카메라 켜기</Text>
                </RippleButton>
              )}
            </View>
          )}
          {/* 모서리 */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </Pressable>
      </View>

      {finding && (
        <View style={styles.noteCard} accessibilityLiveRegion="polite">
          <Text style={styles.noteText}>QR을 읽었어요. 침대를 찾는 중이에요…</Text>
        </View>
      )}

      {!finding && (wrongQR || badId) && (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            {badId
              ? '고유 번호를 넣어 주세요. QR 아래에 적힌 글자(예: B7Q2@192.168.1.2)예요.'
              : '잘자요 침대 QR이 아니에요. 침대 모듈 윗면의 QR을 찍어 주세요.'}
          </Text>
        </View>
      )}

      {showWhere && !finding && (
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
        <RippleButton style={styles.link} rippleColor="#513E39" onPress={() => { setShowWhere(!showWhere); setWrongQR(false); }}>
          <LinkText style={styles.linkText}>{showWhere ? '접기' : 'QR 코드가 안 보여요'}</LinkText>
        </RippleButton>
        <RippleButton style={styles.link} rippleColor="#513E39" onPress={() => { setTyping(true); setWrongQR(false); setBadId(false); }}>
          <LinkText style={styles.linkText}>고유 번호로 입력</LinkText>
        </RippleButton>
        {onCancel ? (
          <RippleButton style={styles.link} rippleColor="#513E39" onPress={onCancel}>
            <LinkText style={styles.linkText}>취소</LinkText>
          </RippleButton>
        ) : (
          <RippleButton style={styles.link} rippleColor="#513E39" onPress={onSettings}>
            <LinkText style={styles.linkText}>설정</LinkText>
          </RippleButton>
        )}
      </View>
      <InputDialog
        open={typing}
        title="고유 번호로 입력"
        message="QR 아래에 적힌 글을 그대로 넣어 주세요."
        value=""
        placeholder="예: B7Q2@192.168.1.2"
        okLabel="확인"
        onOk={(text) => {
          // 11/19: 손 입력 <id>@<보드 IP>[:포트]는 QR과 같은 글(jaljayo://bed/<id>?h=<IP>:<포트>)로 바꿔 넘긴다
          const t = text.replace(/^jaljayo:\/\/bed\//, '').trim();
          setTyping(false);
          const [id, host = ''] = t.split('@').map((x) => x.trim());
          if (!id) return setBadId(true);
          handleScanned(`jaljayo://bed/${id}${host ? `?h=${host.includes(':') ? host : `${host}:8765`}` : ''}`);
        }}
        onClose={() => setTyping(false)}
      />
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
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
  },
  description: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 25.5,
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
  // 카메라를 쓸 수 없을 때 카메라 칸 안 안내
  noCam: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  noCamText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.medium,
    color: '#F4F0ED',
    textAlign: 'center',
  },
  noCamBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 250, 247, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCamBtnText: {
    fontSize: 15,
    fontFamily: font.semiBold,
    color: '#FFFAF7',
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
  // 시안 .ob .links: 높이 48 줄, 아래 여백은 화면 여백(아이폰 40·갤럭시 16)뿐. 글자 버튼이 한 줄에 다 들어가지 않으면 두 줄로 내려간다
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    columnGap: 8,
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
    lineHeight: 25.5,
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