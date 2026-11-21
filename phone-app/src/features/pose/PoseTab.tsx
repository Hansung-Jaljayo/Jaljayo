import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { clockLabel } from '@/features/alarm/alarm';
import { openSettings } from '@/features/app/flow';
import { isNightNow, useBedInfo } from '@/features/bed/bed';
import { boardOpen, onBoardAngles } from '@/features/bed/boardLink';
import { type BedRequest, sendBedCommand, startBedRequest } from '@/features/bed/requests';
import { bed3d } from '@/features/pose/BedView';
import EditPresetsSheet from '@/screens/EditPresetsSheet';
import PostureScreen from '@/screens/PostureScreen';

import {
  type Angles,
  INITIAL_PRESETS,
  LIMIT,
  PRESET_KEYS,
  resolvePose,
  setDefault,
  setLast,
  usePoseStore,
} from './poseStore';

export type PressButton = 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';
type Part = 'head' | 'foot';
const part = (b: PressButton): Part => (b === 'headPlus' || b === 'headMinus' ? 'head' : 'foot');
const dir = (b: PressButton) => (b === 'headPlus' || b === 'footPlus' ? 1 : -1);
// 그 방향 끝에 닿았는지
const atEnd = (b: PressButton, a: Angles) => (dir(b) < 0 ? a[part(b)] <= 0 : a[part(b)] >= LIMIT[part(b)]);

// 시안: 1.2초 이상 걸리는 움직임에만 처음부터 멈춤 버튼·흐린 버튼을 보여 준다(누르는 것은 움직이는 동안 늘 막는다)
const LONG_MOVE = 1200;
// ±를 누르고 있으면 1초에 15도
const HOLD_SPEED = 15;
// 보드에 연결돼 있으면 실제 침대 속도(초당 6도)로 보여 준다
const BOARD_SPEED = 6;
// 각도 시트 ±: 누르자마자 1도, 그 뒤 1초에 15번
const SHEET_REPEAT_MS = 1000 / 15;
const SAVED_MARK_MS = 1600;
const fmt = (a: Angles | null) => (a ? `${a.head}° · ${a.foot}°` : '없음');

type Motion = {
  head: number;
  foot: number;
  moving: boolean;
  holding: PressButton | null;
  // 이번 움직임이 길어 멈춤 버튼을 보여 주는지
  moveVis: boolean;
  // 직접 정한 각도로 움직이는 중이면 그 자세(끝나거나 멈춘 각도를 지난번으로 기록한다)
  recordMove: number | null;
  // 되돌리기: 조절하기 전 각도
  undo: (Angles & { preset: number }) | null;
  purpose: number;
};

const m0: Motion = {
  ...INITIAL_PRESETS[0],
  moving: false,
  holding: null,
  moveVis: false,
  recordMove: null,
  undo: null,
  purpose: 0,
};

// onLock: 침대가 움직이거나 저장을 기다리는 동안 탭 넘기기를 막는다
export function PoseTab({ onLock }: { onLock?: (on: boolean) => void }) {
  const bed = useBedInfo();
  const isDisconnected = !bed.connected;
  // 침대 상태를 읽는 중(앱을 열 때·다시 연결됐을 때). 읽기 전에는 조작을 막는다
  const isLoading = bed.loading && bed.connected;
  // 타이머 안에서 읽는 지금 연결 상태
  const offRef = useRef({ off: isDisconnected, loading: isLoading });
  useEffect(() => {
    offRef.current = { off: isDisconnected, loading: isLoading };
  }, [isDisconnected, isLoading]);
  // 병원용 홈의 밤 안내 줄: 병원용 + 밤에 이름 부르기 끄기 + 지금 밤 시간 + 침대가 시각을 알 때만
  const nightNote =
    bed.ward && bed.ward.night.on && bed.clockOk && isNightNow(bed.ward.night)
      ? `밤 시간 · ${bed.hasButton ? '버튼을 누르고 말해요' : '이름 불러도 대답 안 해요'}`
      : undefined;
  const nightLabel = bed.ward
    ? `밤 시간이에요. ${clockLabel(bed.ward.night.to)}까지 ${bed.hasButton ? '이름 대신 침대 버튼을 누르고 말해 주세요.' : '이름을 불러도 대답하지 않아요.'}`
    : undefined;
  const store = usePoseStore();

  // 침대 움직임은 화면마다 바뀌므로 ref에 두고, 바뀔 때 다시 그린다
  const m = useRef<Motion>({ ...m0 });
  // 화면에 그리는 값: 움직일 때마다 ref를 옮겨 적는다
  const [view, setView] = useState<Motion>(() => ({ ...m0 }));
  // 마지막으로 그린 숫자·상태. 움직이는 중에는 숫자(정수)가 바뀔 때만 다시 그린다(탭 전체를 매 장면 그리면 갤럭시에서 누름이 늦게 들어간다)
  const painted = useRef('');
  const shownKey = (s: Motion) => `${Math.round(s.head)},${Math.round(s.foot)},${s.moving}`;
  const paint = () => {
    painted.current = shownKey(m.current);
    setView({ ...m.current });
  };
  const paintIfShownChanged = () => {
    if (shownKey(m.current) !== painted.current) paint();
  };
  const raf = useRef(0);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // 시트 상태
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetOpenRef = useRef(false);
  const openSheet = (on: boolean) => {
    sheetOpenRef.current = on;
    setSheetOpen(on);
  };
  const [draft, setDraftState] = useState({ purpose: 0, ...INITIAL_PRESETS[0] });
  const draftRef = useRef(draft);
  const setDraft = (d: typeof draft) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const [sheetHold, setSheetHold] = useState<PressButton | null>(null);
  const sheetHoldRef = useRef<{ btn: PressButton; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  // 침대에 보낸 저장·삭제가 끝나지 않음(답을 기다리는 중이거나 답이 없어 "다시 시도"가 뜬 상태). 이 동안은 고치지 못한다
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  // 답을 기다리며 돌아가는 표시
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSheetError, setIsSheetError] = useState(false);
  const [waitKind, setWaitKind] = useState<'save' | 'delete'>('save');
  // 침대가 저장을 거절했을 때 보여 줄 이유
  const [rejectNote, setRejectNote] = useState('');
  const saveRequest = useRef<BedRequest | null>(null);
  const savedConfirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      saveRequest.current?.cancel();
      cancelAnimationFrame(raf.current);
      clearTimeout(savedConfirmTimer.current);
      if (sheetHoldRef.current?.timer) clearTimeout(sheetHoldRef.current.timer);
    },
    [],
  );

  const now = () => ({ head: Math.round(m.current.head), foot: Math.round(m.current.foot) });
  const remember = (i: number) => setLast(i, now());

  // 멈춤: 손을 뗐을 때·멈춤 버튼·끝 각도·연결 끊김이 모두 이 길로 끝난다
  const stop = useCallback(() => {
    const s = m.current;
    const was = s.holding;
    cancelAnimationFrame(raf.current);
    if (s.moving && s.recordMove != null) remember(s.recordMove);
    s.recordMove = null;
    if (s.moving) sendBedCommand({ type: 'bed-stop', body: null });
    s.moving = false;
    s.holding = null;
    bed3d.set(s.head, s.foot);
    // 직접 움직여 바꾼 각도는 지금 자세의 "지난번"으로 기록한다
    if (was) remember(s.purpose);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 목표 각도까지 거리/25초 + 0.25초 동안 부드럽게(시안 goTo)
  const goTo = (p: Angles & { key: number }, noUndo = false, record = false) => {
    const s = m.current;
    cancelAnimationFrame(raf.current);
    if (s.moving && s.recordMove != null) remember(s.recordMove);
    s.recordMove = null;
    const from = { head: s.head, foot: s.foot };
    const dist = Math.max(Math.abs(p.head - s.head), Math.abs(p.foot - s.foot));
    if (!dist) {
      s.purpose = p.key;
      s.moving = false;
      if (record) setLast(p.key, { head: p.head, foot: p.foot });
      paint();
      return;
    }
    if (record) s.recordMove = p.key;
    if (noUndo) s.undo = null;
    else if (!s.moving) s.undo = { ...now(), preset: s.purpose };
    const dur = (dist / (boardOpen() ? BOARD_SPEED : 25)) * 1000 + 250;
    sendBedCommand({ type: 'bed-move', body: { head: p.head, leg: p.foot } });
    const t0 = performance.now();
    s.moveVis = dur >= LONG_MOVE;
    s.purpose = p.key;
    s.moving = true;
    bed3d.move(p.head, p.foot, dur);
    const tick = () => {
      // 화면 갱신이 넘겨주는 시각은 기준이 달라 직접 잰다
      const t = performance.now();
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      s.head = from.head + (p.head - from.head) * e;
      s.foot = from.foot + (p.foot - from.foot) * e;
      if (k >= 1) {
        s.moving = false;
        if (s.recordMove != null) {
          remember(s.recordMove);
          s.recordMove = null;
        }
      }
      paintIfShownChanged();
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const handlePressIn = (b: PressButton) => {
    const s = m.current;
    if (offRef.current.off || offRef.current.loading || pendingRef.current || (s.moving && !s.holding)) return;
    cancelAnimationFrame(raf.current);
    if (s.moving && s.recordMove != null) remember(s.recordMove);
    s.recordMove = null;
    if (!s.moving) s.undo = { ...now(), preset: s.purpose };
    s.holding = b;
    s.moving = true;
    bed3d.hold(part(b) === 'head' ? 'head' : 'leg', dir(b));
    const p = part(b);
    const d = dir(b);
    const holdSpeed = boardOpen() ? BOARD_SPEED : HOLD_SPEED;
    // 누르고 있는 동안은 끝 각도를 향해 움직이고, 손을 떼면 멈춤을 보낸다
    const end = d > 0 ? LIMIT[p] : 0;
    sendBedCommand({ type: 'bed-move', body: { head: p === 'head' ? end : Math.round(s.head), leg: p === 'foot' ? end : Math.round(s.foot) } });
    let last = performance.now();
    const tick = () => {
      // 화면 갱신이 넘겨주는 시각은 기준이 달라 직접 잰다
      const t = performance.now();
      const dt = (t - last) / 1000;
      last = t;
      s[p] = Math.max(0, Math.min(LIMIT[p], s[p] + d * holdSpeed * dt));
      // 진행 방향의 끝에 닿으면 멈춘다
      if ((d < 0 && s[p] <= 0) || (d > 0 && s[p] >= LIMIT[p])) {
        stop();
        return;
      }
      paintIfShownChanged();
      raf.current = requestAnimationFrame(tick);
    };
    paint();
    raf.current = requestAnimationFrame(tick);
  };
  const handlePressOut = () => {
    if (m.current.holding) stop();
  };

  // 말이나 예약으로 움직일 때, 그리고 폰에서 움직인 뒤에는 보드가 알려 주는 각도를 따른다
  useEffect(
    () =>
      onBoardAngles((a) => {
        const s = m.current;
        if (s.moving) return;
        if (s.head === a.head && s.foot === a.leg) return;
        s.head = a.head;
        s.foot = a.leg;
        bed3d.set(s.head, s.foot);
        paintIfShownChanged();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handlePreset = (i: number) => {
    if (m.current.moving) return;
    goTo({ ...resolvePose(i), key: i });
  };

  // 되돌리기: 조절하기 전 각도로. 되돌린 직후에는 버튼을 숨겨 왕복하지 않는다
  const handleUndo = () => {
    const u = m.current.undo;
    if (!u || offRef.current.off || offRef.current.loading || m.current.moving) return;
    goTo({ head: u.head, foot: u.foot, key: u.preset }, true);
  };

  // ---------- 각도 시트 ----------
  const stopSheetHold = useCallback(() => {
    const h = sheetHoldRef.current;
    if (!h) return;
    if (h.timer) clearTimeout(h.timer);
    sheetHoldRef.current = null;
    setSheetHold(null);
  }, []);

  const clearSaved = () => {
    clearTimeout(savedConfirmTimer.current);
    setIsSaved(false);
  };

  // 한 칸(1도) 바꾼다. 더 갈 수 있으면 true
  const stepDraft = (b: PressButton) => {
    const d = draftRef.current;
    if (offRef.current.off || offRef.current.loading || m.current.moving || pendingRef.current || !sheetOpenRef.current) return false;
    const p = part(b);
    const v = Math.max(0, Math.min(LIMIT[p], d[p] + dir(b)));
    if (v === d[p]) return false;
    setDraft({ ...d, [p]: v });
    clearSaved();
    return v > 0 && v < LIMIT[p];
  };

  const handleSheetPressIn = (b: PressButton) => {
    if (m.current.moving || pendingRef.current) return;
    stopSheetHold();
    sheetHoldRef.current = { btn: b, timer: null };
    setSheetHold(b);
    if (!stepDraft(b)) {
      stopSheetHold();
      return;
    }
    const repeat = () => {
      if (sheetHoldRef.current?.btn !== b) return;
      if (!stepDraft(b)) {
        stopSheetHold();
        return;
      }
      sheetHoldRef.current.timer = setTimeout(repeat, SHEET_REPEAT_MS);
    };
    sheetHoldRef.current.timer = setTimeout(repeat, SHEET_REPEAT_MS);
  };
  const handleSheetPressOut = (b: PressButton) => {
    if (sheetHoldRef.current?.btn === b) stopSheetHold();
  };

  const handleOpenEditPresets = () => {
    if (m.current.moving || pendingRef.current) return;
    const p = m.current.purpose;
    setDraft({ purpose: p, ...resolvePose(p) });
    openSheet(true);
  };

  // 닫기: 침대에 보낸 저장·삭제가 끝나지 않았으면 닫지 않는다("취소"로만 닫는다)
  const closeSheet = () => {
    if (pendingRef.current || !sheetOpenRef.current) return;
    stopSheetHold();
    openSheet(false);
  };

  const handleSheetSelectPreset = (i: number) => {
    if (pendingRef.current || m.current.moving) return;
    stopSheetHold();
    clearSaved();
    setDraft({ purpose: i, ...resolvePose(i) });
  };

  // 이 각도로 침대 움직이기: 창을 닫고 침대를 그 각도로 움직인다(저장하지 않는다). 끝나거나 멈춘 각도가 그 자세의 "지난번"이 된다
  const handleMove = () => {
    if (offRef.current.off || offRef.current.loading || pendingRef.current || m.current.moving) return;
    const d = draftRef.current;
    closeSheet();
    goTo({ head: d.head, foot: d.foot, key: d.purpose }, false, true);
  };

  // 기본 각도 저장·삭제: 보낼 때의 자세와 각도를 고정해 침대에 보내고, 침대가 답하면 반영한다.
  // 저장은 버튼 자리에 "저장되었어요"를 잠깐 보여 주고, 5초 넘게 답이 없으면 안내와 "다시 시도"·"취소"만 남긴다
  const sendPose = (kind: 'save' | 'delete') => {
    if (offRef.current.off || offRef.current.loading || m.current.moving || pendingRef.current) return;
    const d = draftRef.current;
    const i = d.purpose;
    const angles = { head: d.head, foot: d.foot };
    clearSaved();
    setIsSheetError(false);
    setRejectNote('');
    setWaitKind(kind);
    setPending(true);
    pendingRef.current = true;
    setIsSaving(true);
    saveRequest.current = startBedRequest(
      kind === 'save'
        ? { type: 'pose-save', body: { preset: PRESET_KEYS[i], head: angles.head, leg: angles.foot } }
        : { type: 'pose-delete', body: { preset: PRESET_KEYS[i] } },
      {
        onAck: (reply) => {
          saveRequest.current = null;
          pendingRef.current = false;
          setPending(false);
          setIsSaving(false);
          setIsSheetError(false);
          if (reply.ok === false) {
            setRejectNote(typeof reply.reason === 'string' && reply.reason ? reply.reason : '저장하지 못했어요');
            return;
          }
          if (kind === 'save') {
            setDefault(i, angles);
            setIsSaved(true);
            savedConfirmTimer.current = setTimeout(() => setIsSaved(false), SAVED_MARK_MS);
          } else setDefault(i, null);
        },
        onTimeout: () => {
          setIsSaving(false);
          setIsSheetError(true);
        },
      },
    );
  };
  const retryPose = () => {
    if (offRef.current.off || offRef.current.loading || !saveRequest.current) return;
    setIsSheetError(false);
    setIsSaving(true);
    saveRequest.current.retry();
  };
  // 취소: 기다리기를 그만두고 창을 닫는다(이미 침대가 처리한 저장은 되돌리지 않는다)
  const cancelPose = () => {
    saveRequest.current?.cancel();
    saveRequest.current = null;
    pendingRef.current = false;
    setPending(false);
    setIsSaving(false);
    setIsSheetError(false);
    setRejectNote('');
    clearSaved();
    stopSheetHold();
    openSheet(false);
  };

  // 연결이 끊기면 조작을 멈춘다. ±를 누르고 있던 중이면 손을 뗐는데 침대가 멈춘 이유를 알린다
  useEffect(() => {
    if (!isDisconnected) return;
    const wasHolding = !!m.current.holding;
    stopSheetHold();
    if (m.current.moving) stop();
    setShowDisconnectDialog(wasHolding);
  }, [isDisconnected, stop, stopSheetHold]);
  // 침대 상태를 다시 읽는 동안에도 멈춘다
  useEffect(() => {
    if (!isLoading) return;
    stopSheetHold();
    if (m.current.moving) stop();
  }, [isLoading, stop, stopSheetHold]);
  // 앱이 뒤로 가면 누르고 있던 것을 멈춘다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') return;
      stopSheetHold();
      if (m.current.holding) stop();
    });
    return () => sub.remove();
  }, [stop, stopSheetHold]);

  // 시안: 움직이는 중이거나 저장 응답을 기다리는 동안 탭 넘김 판을 잠근다
  const lockPager = view.moving || pending;
  useEffect(() => {
    onLock?.(lockPager);
  }, [lockPager, onLock]);

  const s = view;
  const busy = s.moving && (!!s.holding || s.moveVis);
  const blocked = isDisconnected || isLoading;
  const shown = { head: Math.round(s.head), foot: Math.round(s.foot) };
  const holdDisabled = (b: PressButton) => pending || blocked || (s.holding !== b && (busy || atEnd(b, shown)));
  const sheetBusy = busy || pending || blocked;
  const di = draft.purpose;

  return (
    <View style={styles.fill}>
      <PostureScreen
        isLoading={isLoading}
        isDisconnected={isDisconnected}
        isMoving={busy}
        showStop={busy && !s.holding}
        pressingButton={s.holding ?? undefined}
        holdDisabled={holdDisabled}
        controlsDisabled={busy || pending || blocked}
        showUndo={!!s.undo && !busy}
        undoDisabled={pending || blocked}
        activePreset={s.purpose}
        onPreset={handlePreset}
        bedHead={s.head}
        bedLeg={s.foot}
        bedMoving={s.moving}
        headAngle={shown.head}
        footAngle={shown.foot}
        onHoldIn={handlePressIn}
        onHoldOut={handlePressOut}
        onStop={stop}
        onUndo={handleUndo}
        onEditPresets={handleOpenEditPresets}
        onGear={openSettings}
        nightNote={nightNote}
        nightLabel={nightLabel}
      />
      <EditPresetsSheet
        visible={sheetOpen}
        activePreset={di}
        headAngle={draft.head}
        footAngle={draft.foot}
        defaultAngleLabel={`기본 각도 ${fmt(store.defaults[di])}`}
        lastUsedLabel={`지난번 ${fmt(store.last[di])}`}
        hasDefaultAngle={store.defaults[di] !== null}
        lastInUse={!store.defaults[di] && !!store.last[di]}
        pressingButton={sheetHold ?? undefined}
        deltaDisabled={(b) =>
          sheetBusy || atEnd(b, draft) || (!!sheetHold && sheetHold !== b)
        }
        actionsDisabled={sheetBusy || !!sheetHold}
        isSaving={isSaving}
        waitKind={waitKind}
        isSaved={isSaved}
        isError={isSheetError}
        retryDisabled={blocked}
        note={rejectNote}
        onClose={closeSheet}
        onSelectPreset={handleSheetSelectPreset}
        onHoldIn={handleSheetPressIn}
        onHoldOut={handleSheetPressOut}
        onMove={handleMove}
        onSaveOnly={() => sendPose('save')}
        onDeleteSaved={() => sendPose('delete')}
        onRetry={retryPose}
        onCancel={cancelPose}
      />
      <ConfirmDialog
        open={showDisconnectDialog && isDisconnected}
        title="연결이 끊겨 조작을 멈췄어요"
        message="침대와 다시 연결되면 다시 조작할 수 있어요."
        onOk={() => setShowDisconnectDialog(false)}
        onClose={() => setShowDisconnectDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
