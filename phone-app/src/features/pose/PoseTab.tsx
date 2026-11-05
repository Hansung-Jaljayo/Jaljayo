import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type TabKey } from '@/components/TabBar';
import { clockLabel } from '@/features/alarm/alarm';
import { openSettings } from '@/features/app/flow';
import { isNightNow, useBedInfo } from '@/features/bed/bed';
import { type BedRequest, startBedRequest } from '@/features/bed/requests';
import EditPresetsSheet from '@/screens/EditPresetsSheet';
import PostureScreen from '@/screens/PostureScreen';

type PressButton = 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';

const DEBOUNCE_MS = 1500;
const MOVING_MS = 2000;
const ANGLE_INTERVAL_MS = 100;
const HEAD_MIN = 0;
const HEAD_MAX = 60;
const FOOT_MIN = 0;
const FOOT_MAX = 40;
const SHEET_FOOT_MAX = FOOT_MAX;

type Angles = { head: number; foot: number };
const PRESET_KEYS = ['read', 'tv', 'rest', 'sleep'] as const;

// 자세별 처음 각도(시안과 같다)
const INITIAL_PRESETS: Angles[] = [
  { head: 45, foot: 15 }, // 독서
  { head: 30, foot: 10 }, // TV
  { head: 15, foot: 20 }, // 휴식
  { head: 0, foot: 0 }, // 잠
];
const SAVED_MARK_MS = 1600;
const fmt = (a: Angles | null) => (a ? `${a.head}° · ${a.foot}°` : '없음');

export function PoseTab({ onTab }: { onTab?: (key: TabKey) => void }) {
  const bed = useBedInfo();
  const isDisconnected = !bed.connected;
  // 침대 상태를 읽는 중(앱을 열 때·다시 연결됐을 때). 읽기 전에는 조작을 막는다
  const isLoading = bed.loading && bed.connected;
  // 병원용 홈의 밤 안내 줄: 병원용 + 밤에 이름 부르기 끄기 + 지금 밤 시간 + 침대가 시각을 알 때만
  const nightNote =
    bed.ward && bed.ward.night.on && bed.clockOk && isNightNow(bed.ward.night)
      ? `밤 시간 · ${bed.hasButton ? '버튼을 누르고 말해요' : '이름 불러도 대답 안 해요'}`
      : undefined;
  const nightLabel = bed.ward
    ? `밤 시간이에요. ${clockLabel(bed.ward.night.to)}까지 ${bed.hasButton ? '이름 대신 침대 버튼을 누르고 말해 주세요.' : '이름을 불러도 대답하지 않아요.'}`
    : undefined;
  const [pressingButton, setPressingButton] = useState<PressButton | undefined>();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoDisabled, setUndoDisabled] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [headAngle, setHeadAngle] = useState(INITIAL_PRESETS[0].head);
  const [footAngle, setFootAngle] = useState(INITIAL_PRESETS[0].foot);
  // 자세 버튼이 가는 각도: 저장한 기본 각도 → 없으면 지난번(직접 움직여 쓴 각도) → 없으면 처음 각도
  const [defaults, setDefaults] = useState<(Angles | null)[]>([null, null, null, null]);
  // 시안 표본: TV는 지난번에 25도로 썼다
  const [last, setLast] = useState<(Angles | null)[]>([null, { head: 25, foot: 10 }, null, null]);
  const target = (i: number) => defaults[i] ?? last[i] ?? INITIAL_PRESETS[i];
  const remember = (i: number, a: Angles) => setLast((l) => l.map((x, k) => (k === i ? a : x)));
  const angleRef = useRef<Angles>({ head: headAngle, foot: footAngle });
  useEffect(() => {
    angleRef.current = { head: headAngle, foot: footAngle };
  }, [headAngle, footAngle]);

  // 시트 상태
  const [showEditPresetsSheet, setShowEditPresetsSheet] = useState(false);
  const [sheetActivePreset, setSheetActivePreset] = useState(0);
  const [sheetHeadAngle, setSheetHeadAngle] = useState(INITIAL_PRESETS[0].head);
  const [sheetFootAngle, setSheetFootAngle] = useState(INITIAL_PRESETS[0].foot);
  const [sheetPressingButton, setSheetPressingButton] = useState<PressButton | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSheetError, setIsSheetError] = useState(false);
  // 침대에 보낸 저장·삭제(답을 기다리는 중)
  const [waitKind, setWaitKind] = useState<'save' | 'delete'>('save');
  // 침대가 저장을 거절했을 때 보여 줄 이유
  const [rejectNote, setRejectNote] = useState('');
  const saveRequest = useRef<BedRequest | null>(null);
  useEffect(() => () => saveRequest.current?.cancel(), []);
  const pressStart = useRef<Angles | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const movingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const angleInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const sheetAngleInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const savedConfirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedAngles = useRef<{ head: number; foot: number; preset: number } | null>(null);

  // 연결이 끊기면 누르고 있던 움직임을 멈춘다
  useEffect(() => {
    if (!isDisconnected) return;
    clearInterval(angleInterval.current);
    clearInterval(sheetAngleInterval.current);
  }, [isDisconnected]);

  const handlePressIn = (button: PressButton) => {
    if (isDisconnected || isLoading) return;
    setPressingButton(button);
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setIsMoving(false);

    if (!savedAngles.current) {
      savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
      setUndoDisabled(false);
    }
    pressStart.current = { head: headAngle, foot: footAngle };

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
    // 직접 움직여 바꾼 각도는 지금 자세의 "지난번"으로 기록한다
    const now = angleRef.current;
    const from = pressStart.current;
    pressStart.current = null;
    if (from && (from.head !== now.head || from.foot !== now.foot)) remember(activePreset, { ...now });
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

  const handleStop = () => {
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    setIsMoving(false);
  };

  const handlePreset = (index: number) => {
    const to = target(index);
    // 이미 그 각도면 움직이지 않는다
    if (to.head === headAngle && to.foot === footAngle) {
      setActivePreset(index);
      return;
    }
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
    setUndoDisabled(false);
    setActivePreset(index);
    setHeadAngle(to.head);
    setFootAngle(to.foot);
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

  const handleOpenEditPresets = () => {
    clearTimeout(savedConfirmTimer.current);
    setSheetActivePreset(activePreset);
    setSheetHeadAngle(target(activePreset).head);
    setSheetFootAngle(target(activePreset).foot);
    setIsSaved(false);
    setIsSheetError(false);
    setShowEditPresetsSheet(true);
  };

  // 닫기: 답을 기다리는 중이면 닫지 않는다. 답이 없어 "다시 시도"가 뜬 뒤의 취소는 기다리기를 그만두고 닫는다
  const handleCloseEditPresetsSheet = () => {
    if (isSaving) return;
    saveRequest.current?.cancel();
    saveRequest.current = null;
    clearInterval(sheetAngleInterval.current);
    clearTimeout(savedConfirmTimer.current);
    setSheetPressingButton(undefined);
    setIsSaved(false);
    setIsSheetError(false);
    setRejectNote('');
    setShowEditPresetsSheet(false);
  };

  const handleSheetSelectPreset = (index: number) => {
    clearInterval(sheetAngleInterval.current);
    setSheetPressingButton(undefined);
    setSheetActivePreset(index);
    setSheetHeadAngle(target(index).head);
    setSheetFootAngle(target(index).foot);
    setIsSaved(false);
    setIsSheetError(false);
  };

  const handleSheetPressIn = (button: PressButton) => {
    // 값을 바꾸면 "저장되었어요"를 바로 거둔다(바뀐 값은 아직 저장 전)
    clearTimeout(savedConfirmTimer.current);
    setIsSaved(false);
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

  // 이 각도로 침대 움직이기: 창을 닫고 침대를 그 각도로 움직인다(저장하지 않는다). 움직인 각도는 그 자세의 "지난번"이 된다
  const handleMove = () => {
    if (isDisconnected || isLoading || isSaving) return;
    const to = { head: sheetHeadAngle, foot: sheetFootAngle };
    const i = sheetActivePreset;
    handleCloseEditPresetsSheet();
    clearTimeout(debounceTimer.current);
    clearTimeout(movingTimer.current);
    remember(i, to);
    setActivePreset(i);
    if (to.head === headAngle && to.foot === footAngle) return;
    savedAngles.current = { head: headAngle, foot: footAngle, preset: activePreset };
    setUndoDisabled(false);
    setHeadAngle(to.head);
    setFootAngle(to.foot);
    setShowUndo(true);
    setIsMoving(true);
    movingTimer.current = setTimeout(() => {
      setIsMoving(false);
      savedAngles.current = null;
      setShowUndo(false);
    }, MOVING_MS);
  };

  // 기본 각도 저장·삭제: 침대에 보내고, 침대가 저장했다고 답하면 반영한다.
  // 저장은 버튼 자리에 "저장되었어요"를 잠깐 보여 주고, 5초 넘게 답이 없으면 안내와 "다시 시도"·"취소"
  const sendPose = (kind: 'save' | 'delete') => {
    if (isDisconnected || isLoading || saveRequest.current) return;
    const i = sheetActivePreset;
    const angles = { head: sheetHeadAngle, foot: sheetFootAngle };
    clearTimeout(savedConfirmTimer.current);
    setIsSaved(false);
    setIsSheetError(false);
    setRejectNote('');
    setWaitKind(kind);
    setIsSaving(true);
    saveRequest.current = startBedRequest(
      kind === 'save'
        ? { type: 'pose-save', body: { preset: PRESET_KEYS[i], head: angles.head, leg: angles.foot } }
        : { type: 'pose-delete', body: { preset: PRESET_KEYS[i] } },
      {
        onAck: (reply) => {
          saveRequest.current = null;
          setIsSaving(false);
          setIsSheetError(false);
          if (reply.ok === false) {
            setRejectNote(typeof reply.reason === 'string' && reply.reason ? reply.reason : '저장하지 못했어요');
            return;
          }
          if (kind === 'save') {
            setDefaults((d) => d.map((x, k) => (k === i ? angles : x)));
            setIsSaved(true);
            savedConfirmTimer.current = setTimeout(() => setIsSaved(false), SAVED_MARK_MS);
          } else {
            setDefaults((d) => d.map((x, k) => (k === i ? null : x)));
            const back = last[i] ?? INITIAL_PRESETS[i];
            setSheetHeadAngle(back.head);
            setSheetFootAngle(back.foot);
          }
        },
        onTimeout: () => {
          setIsSaving(false);
          setIsSheetError(true);
        },
      },
    );
  };
  const retryPose = () => {
    if (isDisconnected || isLoading || !saveRequest.current) return;
    setIsSheetError(false);
    setIsSaving(true);
    saveRequest.current.retry();
  };

  return (
    <View style={styles.fill}>
      <PostureScreen
        isLoading={isLoading}
        isDisconnected={isDisconnected}
        showDisconnectDialog={showDisconnectDialog}
        isMoving={isMoving}
        pressingButton={isDisconnected ? undefined : pressingButton}
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
        onDismissDisconnectDialog={() => setShowDisconnectDialog(false)}
        onEditPresets={handleOpenEditPresets}
        onGear={openSettings}
        onTabChange={onTab}
        nightNote={nightNote}
        nightLabel={nightLabel}
      />
      <EditPresetsSheet
        visible={showEditPresetsSheet}
        activePreset={sheetActivePreset}
        headAngle={sheetHeadAngle}
        footAngle={sheetFootAngle}
        defaultAngleLabel={`기본 각도 ${fmt(defaults[sheetActivePreset])}`}
        pressingButton={sheetPressingButton}
        lastUsedLabel={`지난번 ${fmt(last[sheetActivePreset])}`}
        lastInUse={!defaults[sheetActivePreset] && !!last[sheetActivePreset]}
        isSaving={isSaving}
        waitKind={waitKind}
        isSaved={isSaved}
        hasDefaultAngle={defaults[sheetActivePreset] !== null}
        isError={isSheetError}
        isOffline={isDisconnected || isLoading}
        note={rejectNote}
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
        onMoveAndSave={handleMove}
        onSaveOnly={() => sendPose('save')}
        onDeleteSaved={() => sendPose('delete')}
        onRetry={retryPose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});