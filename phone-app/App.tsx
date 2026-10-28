import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PostureScreen from './src/screens/PostureScreen';

type PressButton = 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';

const DEBOUNCE_MS = 1500; // 마지막 버튼 뗀 후 이 시간이 지나면 침대가 움직임
const MOVING_MS = 2000;   // 침대 움직임 지속 시간
const ANGLE_INTERVAL_MS = 100; // 버튼 누르는 동안 각도 변경 주기
const HEAD_MIN = 0;
const HEAD_MAX = 60;
const FOOT_MIN = 0;
const FOOT_MAX = 60;

const PRESETS: { head: number; foot: number }[] = [
  { head: 45, foot: 15 }, // 독서
  { head: 35, foot: 10 }, // TV
  { head: 20, foot: 20 }, // 휴식
  { head: 5,  foot: 5  }, // 잠
];

export default function App() {
  const [pressingButton, setPressingButton] = useState<PressButton | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoDisabled, setUndoDisabled] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [headAngle, setHeadAngle] = useState(PRESETS[0].head);
  const [footAngle, setFootAngle] = useState(PRESETS[0].foot);
  const loadingTimer = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const movingTimer = useRef<ReturnType<typeof setTimeout>>();
  const angleInterval = useRef<ReturnType<typeof setInterval>>();
  const savedAngles = useRef<{ head: number; foot: number; preset: number } | null>(null);

  // 앱 시작 시 침대 데이터 불러오기 시뮬레이션
  useEffect(() => {
    loadingTimer.current = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(loadingTimer.current);
  }, []);

  // 누르는 중 연결이 끊겼을 때 호출 (실제 구현에서는 소켓/BLE 이벤트로 트리거)
  const handleDisconnectDuringPress = () => {
    clearInterval(angleInterval.current);
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setPressingButton(undefined);
    setIsMoving(false);
    setIsDisconnected(true);
    setShowDisconnectDialog(true);
  };

  const handlePressIn = (button: PressButton) => {
    if (isDisconnected) return;
    // 버튼 누르면 즉시 시각적 피드백, 기존 타이머 취소
    setPressingButton(button);
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setIsMoving(false);

    // 첫 번째 누름일 때만 현재 각도를 저장 (되돌리기용)
    if (!savedAngles.current) {
      savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
      setUndoDisabled(false);
    }

    // 버튼 누르는 동안 각도 증감
    clearInterval(angleInterval.current);
    angleInterval.current = setInterval(() => {
      if (button === 'headPlus') {
        setHeadAngle(prev => Math.min(prev + 1, HEAD_MAX));
      } else if (button === 'headMinus') {
        setHeadAngle(prev => Math.max(prev - 1, HEAD_MIN));
      } else if (button === 'footPlus') {
        setFootAngle(prev => Math.min(prev + 1, FOOT_MAX));
      } else if (button === 'footMinus') {
        setFootAngle(prev => Math.max(prev - 1, FOOT_MIN));
      }
    }, ANGLE_INTERVAL_MS);
  };

  const handlePressOut = () => {
    clearInterval(angleInterval.current);
    setPressingButton(undefined);
    if (savedAngles.current) setShowUndo(true);
    // 마지막 버튼 뗀 후 DEBOUNCE_MS 뒤에 침대 이동 시작
    debounceTimer.current = setTimeout(() => {
      setIsMoving(true);
      savedAngles.current = null; // 이동 확정 시 되돌리기 기준점 초기화
      movingTimer.current = setTimeout(() => {
        setIsMoving(false);
        setShowUndo(false);
      }, MOVING_MS);
    }, DEBOUNCE_MS);
  };

  const handleDismissDisconnectDialog = () => {
    setShowDisconnectDialog(false);
  };

  const handleStop = () => {
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setIsMoving(false);
  };

  const handlePreset = (index: number) => {
    if (index === activePreset) return;
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
    setUndoDisabled(false);
    setActivePreset(index);
    setHeadAngle(PRESETS[index].head);
    setFootAngle(PRESETS[index].foot);
    setShowUndo(true);
    setIsMoving(true);
    movingTimer.current = setTimeout(() => {
      setIsMoving(false);
      savedAngles.current = null;
      setShowUndo(false);
    }, MOVING_MS);
  };

  const handleUndo = () => {
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setShowUndo(false);
    if (savedAngles.current) {
      setHeadAngle(savedAngles.current.head);
      setFootAngle(savedAngles.current.foot);
      setActivePreset(savedAngles.current.preset);
      savedAngles.current = null;
      setUndoDisabled(true);
      setIsMoving(true);
      movingTimer.current = setTimeout(() => {
        setIsMoving(false);
      }, MOVING_MS);
    }
  };

  return (
    <SafeAreaProvider>
      <PostureScreen
        isLoading={isLoading}
        isDisconnected={isDisconnected}
        showDisconnectDialog={showDisconnectDialog}
        isMoving={isMoving}
        pressingButton={pressingButton}
        showUndo={showUndo}
        activePreset={activePreset}
        onPreset={handlePreset}
        undoDisabled={undoDisabled}
        headAngle={headAngle}
        footAngle={footAngle}
        onHeadPlusPressIn={() => handlePressIn('headPlus')}
        onHeadPlusPressOut={handlePressOut}
        onHeadMinusPressIn={() => handlePressIn('headMinus')}
        onHeadMinusPressOut={handlePressOut}
        onFootPlusPressIn={() => handlePressIn('footPlus')}
        onFootPlusPressOut={handlePressOut}
        onFootMinusPressIn={() => handlePressIn('footMinus')}
        onFootMinusPressOut={handlePressOut}
        onStop={handleStop}
        onUndo={handleUndo}
        onDismissDisconnectDialog={handleDismissDisconnectDialog}
      />
    </SafeAreaProvider>
  );
}