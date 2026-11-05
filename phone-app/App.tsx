import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EditPresetsSheet from './src/screens/EditPresetsSheet';
import PostureScreen from './src/screens/PostureScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OpenSourceScreen from './src/screens/OpenSourceScreen';
import TermsScreen from './src/screens/TermsScreen';

type PressButton = 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';

const DEBOUNCE_MS = 1500; // 마지막 버튼 뗀 후 이 시간이 지나면 침대가 움직임
const MOVING_MS = 2000;   // 침대 움직임 지속 시간
const ANGLE_INTERVAL_MS = 100; // 버튼 누르는 동안 각도 변경 주기
const HEAD_MIN = 0;
const HEAD_MAX = 60;
const FOOT_MIN = 0;
const FOOT_MAX = 60;
const SHEET_FOOT_MAX = 40; // 시트에서 다리 최대 범위

const INITIAL_PRESETS: { head: number; foot: number }[] = [
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
  const [headAngle, setHeadAngle] = useState(INITIAL_PRESETS[0].head);
  const [footAngle, setFootAngle] = useState(INITIAL_PRESETS[0].foot);
  const [presets, setPresets] = useState(INITIAL_PRESETS);

  // 설정 화면 상태
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showOpenSource, setShowOpenSource] = useState(false);

  // 시트 상태
  const [showEditPresetsSheet, setShowEditPresetsSheet] = useState(false);
  const [sheetActivePreset, setSheetActivePreset] = useState(0);
  const [sheetHeadAngle, setSheetHeadAngle] = useState(INITIAL_PRESETS[0].head);
  const [sheetFootAngle, setSheetFootAngle] = useState(INITIAL_PRESETS[0].foot);
  const [sheetPressingButton, setSheetPressingButton] = useState<PressButton | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSheetError, setIsSheetError] = useState(false);
  const [savedPresetAngles, setSavedPresetAngles] = useState<({ head: number; foot: number } | null)[]>([null, null, null, null]);
  const [prevSavedPresetAngles, setPrevSavedPresetAngles] = useState<({ head: number; foot: number } | null)[]>([null, null, null, null]);

  const loadingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const movingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const angleInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const sheetAngleInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const savingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedConfirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    setPressingButton(button);
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setIsMoving(false);

    if (!savedAngles.current) {
      savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
      setUndoDisabled(false);
    }

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
    debounceTimer.current = setTimeout(() => {
      setIsMoving(true);
      savedAngles.current = null;
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
    setHeadAngle(presets[index].head);
    setFootAngle(presets[index].foot);
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

  // 시트 핸들러
  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  const handleOpenEditPresets = () => {
    clearTimeout(savedConfirmTimer.current);
    setSheetActivePreset(activePreset);
    setSheetHeadAngle(presets[activePreset].head);
    setSheetFootAngle(presets[activePreset].foot);
    setIsSaved(false);
    setIsSheetError(false);
    setShowEditPresetsSheet(true);
  };

  const handleCloseEditPresetsSheet = () => {
    clearInterval(sheetAngleInterval.current);
    clearTimeout(savedConfirmTimer.current);
    setSheetPressingButton(undefined);
    setIsSaved(false);
    setIsSheetError(false);
    setShowEditPresetsSheet(false);
  };

  const handleSheetSelectPreset = (index: number) => {
    clearInterval(sheetAngleInterval.current);
    setSheetPressingButton(undefined);
    setSheetActivePreset(index);
    setSheetHeadAngle(presets[index].head);
    setSheetFootAngle(presets[index].foot);
    setIsSaved(false);
    setIsSheetError(false);
  };

  const handleSheetPressIn = (button: PressButton) => {
    setSheetPressingButton(button);
    clearInterval(sheetAngleInterval.current);
    sheetAngleInterval.current = setInterval(() => {
      if (button === 'headPlus') {
        setSheetHeadAngle(prev => Math.min(prev + 1, HEAD_MAX));
      } else if (button === 'headMinus') {
        setSheetHeadAngle(prev => Math.max(prev - 1, HEAD_MIN));
      } else if (button === 'footPlus') {
        setSheetFootAngle(prev => Math.min(prev + 1, SHEET_FOOT_MAX));
      } else if (button === 'footMinus') {
        setSheetFootAngle(prev => Math.max(prev - 1, FOOT_MIN));
      }
    }, ANGLE_INTERVAL_MS);
  };

  const handleSheetPressOut = () => {
    clearInterval(sheetAngleInterval.current);
    setSheetPressingButton(undefined);
  };

  const doMoveAndSave = () => {
    setIsSaving(true);
    setIsSheetError(false);
    savingTimer.current = setTimeout(() => {
      const saved = { head: sheetHeadAngle, foot: sheetFootAngle };
      setPresets(prev => prev.map((p, i) => i === sheetActivePreset ? saved : p));
      savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
      setUndoDisabled(false);
      setActivePreset(sheetActivePreset);
      setHeadAngle(sheetHeadAngle);
      setFootAngle(sheetFootAngle);
      setShowUndo(true);
      setIsMoving(true);
      movingTimer.current = setTimeout(() => {
        setIsMoving(false);
        savedAngles.current = null;
        setShowUndo(false);
      }, MOVING_MS);
      setIsSaving(false);
      setShowEditPresetsSheet(false);
    }, 800);
  };

  const handleSheetMoveAndSave = () => doMoveAndSave();
  const handleSheetRetry = () => doMoveAndSave();

  const handleSheetDeleteSaved = () => {
    clearTimeout(savedConfirmTimer.current);
    setPresets(prev => prev.map((p, i) =>
      i === sheetActivePreset ? INITIAL_PRESETS[sheetActivePreset] : p
    ));
    setSavedPresetAngles(prev => prev.map((a, i) => i === sheetActivePreset ? null : a));
    setPrevSavedPresetAngles(prev => prev.map((a, i) => i === sheetActivePreset ? null : a));
    setSheetHeadAngle(INITIAL_PRESETS[sheetActivePreset].head);
    setSheetFootAngle(INITIAL_PRESETS[sheetActivePreset].foot);
    setIsSaved(false);
  };

  const handleSheetSaveOnly = () => {
    setIsSaving(true);
    savingTimer.current = setTimeout(() => {
      const saved = { head: sheetHeadAngle, foot: sheetFootAngle };
      setPresets(prev => prev.map((p, i) => i === sheetActivePreset ? saved : p));
      setPrevSavedPresetAngles(prev => prev.map((a, i) => i === sheetActivePreset ? savedPresetAngles[sheetActivePreset] : a));
      setSavedPresetAngles(prev => prev.map((a, i) => i === sheetActivePreset ? saved : a));
      setIsSaving(false);
      setIsSaved(true);
      clearTimeout(savedConfirmTimer.current);
      savedConfirmTimer.current = setTimeout(() => setIsSaved(false), 2000);
    }, 800);
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
        onEditPresets={handleOpenEditPresets}
        onGear={handleOpenSettings}
      />
      <SettingsScreen
        visible={showSettings}
        isRegistered={true}
        isConnected={!isDisconnected}
        bedName="잘자요 침대"
        bedStatus={isDisconnected ? '연결 끊김 · 다시 연결 중' : '연결됨 · 이 폰으로 조작 중'}
        firmwareVersion="0.2"
        onClose={handleCloseSettings}
        onRenameBed={() => {}}
        onNightTime={() => {}}
        onUnregister={() => setShowSettings(false)}
        onReregister={() => {}}
        onResetBed={() => {}}
        onContact={() => {}}
        onPrivacyPolicy={() => setShowPrivacyPolicy(true)}
        onTerms={() => setShowTerms(true)}
        onOpenSource={() => setShowOpenSource(true)}
        onHospitalAdmin={() => {}}
      />
      <EditPresetsSheet
        visible={showEditPresetsSheet}
        activePreset={sheetActivePreset}
        headAngle={sheetHeadAngle}
        footAngle={sheetFootAngle}
        defaultAngleLabel={
          savedPresetAngles[sheetActivePreset]
            ? `기본 각도 ${savedPresetAngles[sheetActivePreset]!.head}° · ${savedPresetAngles[sheetActivePreset]!.foot}°`
            : undefined
        }
        pressingButton={sheetPressingButton}
        lastUsedLabel={
          prevSavedPresetAngles[sheetActivePreset]
            ? `이전 ${prevSavedPresetAngles[sheetActivePreset]!.head}° · ${prevSavedPresetAngles[sheetActivePreset]!.foot}°`
            : undefined
        }
        isSaving={isSaving}
        isSaved={isSaved}
        hasDefaultAngle={savedPresetAngles[sheetActivePreset] !== null}
        isError={isSheetError}
        onClose={handleCloseEditPresetsSheet}
        onSelectPreset={handleSheetSelectPreset}
        onHeadPlusPressIn={() => handleSheetPressIn('headPlus')}
        onHeadPlusPressOut={handleSheetPressOut}
        onHeadMinusPressIn={() => handleSheetPressIn('headMinus')}
        onHeadMinusPressOut={handleSheetPressOut}
        onFootPlusPressIn={() => handleSheetPressIn('footPlus')}
        onFootPlusPressOut={handleSheetPressOut}
        onFootMinusPressIn={() => handleSheetPressIn('footMinus')}
        onFootMinusPressOut={handleSheetPressOut}
        onMoveAndSave={handleSheetMoveAndSave}
        onSaveOnly={handleSheetSaveOnly}
        onDeleteSaved={handleSheetDeleteSaved}
        onRetry={handleSheetRetry}
      />
      <PrivacyPolicyScreen
        visible={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
      <TermsScreen
        visible={showTerms}
        onClose={() => setShowTerms(false)}
      />
      <OpenSourceScreen
        visible={showOpenSource}
        onClose={() => setShowOpenSource(false)}
      />
    </SafeAreaProvider>
  );
}