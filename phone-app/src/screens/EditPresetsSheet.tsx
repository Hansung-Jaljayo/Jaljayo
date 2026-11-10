import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { LinkText } from '@/components/ObScreen';
import { RippleButton } from '@/components/RippleButton';
import { BedPreview } from '@/features/pose/BedPreview';
import { color, font, cssEase } from '@/theme/tokens';

import { HoldButton, type HoldKey } from './PostureScreen';

// 시안 CSS ease
const EASE = Easing.bezier(...cssEase);

const PRESET_LABELS = ['독서', 'TV', '휴식', '잠'];
const sheetEase = Easing.bezier(0.32, 0.72, 0, 1);

interface Props {
  visible?: boolean;
  activePreset?: number;
  headAngle?: number;
  footAngle?: number;
  defaultAngleLabel?: string;
  lastUsedLabel?: string;
  // 누르고 있는 ±
  pressingButton?: HoldKey;
  // ±마다 막힘(움직이는 중·저장 대기·끊김·끝 각도·다른 ±를 누르는 중)
  deltaDisabled?: (b: HoldKey) => boolean;
  // 자세 고르기·움직이기·저장·삭제를 막는다
  actionsDisabled?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
  hasDefaultAngle?: boolean;
  // 답이 없어 "다시 시도"·"취소"만 남은 상태
  isError?: boolean;
  retryDisabled?: boolean;
  // 저장 중인지 삭제 중인지("저장 중…"·"삭제 중…")
  waitKind?: 'save' | 'delete';
  // 기본 각도가 없고 지난번 각도를 쓰는 중이면 지난번을 진하게
  lastInUse?: boolean;
  // 침대가 저장을 거절한 이유(없으면 안 보인다)
  note?: string;
  onClose?: () => void;
  onSelectPreset?: (index: number) => void;
  onHoldIn?: (b: HoldKey) => void;
  onHoldOut?: (b: HoldKey) => void;
  onMove?: () => void;
  onSaveOnly?: () => void;
  onDeleteSaved?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
}

function SheetAngleRow({
  label,
  range,
  angle,
  keys,
  pressing,
  deltaDisabled,
  onHoldIn,
  onHoldOut,
}: {
  label: string;
  range: string;
  angle: number;
  keys: [HoldKey, HoldKey];
  pressing?: HoldKey;
  deltaDisabled?: (b: HoldKey) => boolean;
  onHoldIn?: (b: HoldKey) => void;
  onHoldOut?: (b: HoldKey) => void;
}) {
  const [minus, plus] = keys;
  return (
    <View style={sctlStyles.row}>
      <View style={sctlStyles.nameGroup}>
        <Text style={sctlStyles.name}>{label}</Text>
        <Text style={sctlStyles.range}>{range}</Text>
      </View>
      <HoldButton
        kind="minus"
        label={`${label} 1도 내리기`}
        style={[sctlStyles.hold, sctlStyles.holdBtnLeft]}
        active={pressing === minus}
        disabled={!!deltaDisabled?.(minus)}
        onIn={() => onHoldIn?.(minus)}
        onOut={() => onHoldOut?.(minus)}
      />
      <View style={sctlStyles.valGroup}>
        {/* 시안 시트는 °까지 같은 글자 크기(홈 카드와 다르다) */}
        <Text style={sctlStyles.valNum}>{angle}°</Text>
      </View>
      <HoldButton
        kind="plus"
        label={`${label} 1도 올리기`}
        style={[sctlStyles.hold, sctlStyles.holdBtnRight]}
        active={pressing === plus}
        disabled={!!deltaDisabled?.(plus)}
        onIn={() => onHoldIn?.(plus)}
        onOut={() => onHoldOut?.(plus)}
      />
    </View>
  );
}

// 저장한 각도 삭제: 숨기지 않고 높이를 0↔50으로 천천히 바꿔 시트가 두루마리처럼 늘고 준다(시안 .del)
function DeleteRow({ show, disabled, onPress }: { show: boolean; disabled: boolean; onPress?: () => void }) {
  const [k] = useState(() => new Animated.Value(show ? 1 : 0));
  const [op] = useState(() => new Animated.Value(show ? 1 : 0));
  useEffect(() => {
    Animated.timing(k, { toValue: show ? 1 : 0, duration: 450, easing: sheetEase, useNativeDriver: false }).start();
    Animated.timing(op, { toValue: show ? 1 : 0, duration: 300, easing: EASE, useNativeDriver: false }).start();
  }, [show, k, op]);
  const height = k.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const marginTop = k.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  return (
    <Animated.View style={{ height, marginTop, opacity: op, overflow: 'hidden' }} pointerEvents={show ? 'auto' : 'none'}>
      <RippleButton
        style={styles.deleteBtn}
        rippleColor={color.red}
        onPress={onPress}
        disabled={disabled || !show}
        accessibilityElementsHidden={!show}
        importantForAccessibility={show ? 'auto' : 'no-hide-descendants'}
      >
        <LinkText style={styles.deleteBtnText}>저장한 각도 삭제</LinkText>
      </RippleButton>
    </Animated.View>
  );
}

export default function EditPresetsSheet({
  visible = false,
  activePreset = 0,
  headAngle = 45,
  footAngle = 15,
  defaultAngleLabel = '기본 각도 없음',
  lastUsedLabel = '지난번 없음',
  pressingButton,
  deltaDisabled,
  actionsDisabled = false,
  isSaving = false,
  isSaved = false,
  hasDefaultAngle = false,
  isError = false,
  retryDisabled = false,
  waitKind = 'save',
  lastInUse = false,
  note = '',
  onClose,
  onSelectPreset,
  onHoldIn,
  onHoldOut,
  onMove,
  onSaveOnly,
  onDeleteSaved,
  onRetry,
  onCancel,
}: Props) {
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (isSaving) {
      Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      rotation.stopAnimation();
      rotation.setValue(0);
    }
  }, [isSaving, rotation]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const noop = () => {};

  return (
    <BottomSheet open={visible} onClose={onClose ?? noop} topGap={56} toEnd={isError}>
      {/* 헤더 */}
      <View style={styles.shead}>
        <Text style={styles.title} role="heading">자세별 기본 각도 수정</Text>
        <RippleButton style={styles.closeBtn} onPress={onClose} accessibilityLabel="닫기">
          <View style={[styles.xLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.xLine, { transform: [{ rotate: '-45deg' }] }]} />
        </RippleButton>
      </View>

      {/* 자세 고르기 */}
      <View style={styles.purposeTabs} role="radiogroup" accessibilityLabel="자세">
        {PRESET_LABELS.map((label, i) => (
          <RippleButton
            key={label}
            role="radio"
            aria-checked={i === activePreset}
            style={[styles.purposeBtn, i === activePreset && styles.purposeBtnActive, actionsDisabled && styles.actionDisabled]}
            rippleColor={i === activePreset ? color['on-ink'] : color.fg}
            onPress={() => onSelectPreset?.(i)}
            disabled={actionsDisabled}
          >
            <Text style={[styles.purposeText, i === activePreset && styles.purposeTextActive]}>{label}</Text>
          </RippleButton>
        ))}
      </View>

      {/* 기본 각도 · 지난번 */}
      <View style={styles.pair}>
        <Text style={[styles.pairText, hasDefaultAngle && styles.pairTextSaved]}>{defaultAngleLabel}</Text>
        <Text style={[styles.pairText, lastInUse && styles.pairTextSaved]}>{lastUsedLabel}</Text>
      </View>

      {/* 미리보기: 고른 각도의 침대 사진 */}
      <View style={styles.preview}>
        <BedPreview head={headAngle} leg={footAngle} />
      </View>

      {/* 각도 조절 */}
      <View style={styles.sctl}>
        <SheetAngleRow
          label="머리"
          range="0 - 60도"
          angle={headAngle}
          keys={['headMinus', 'headPlus']}
          pressing={pressingButton}
          deltaDisabled={deltaDisabled}
          onHoldIn={onHoldIn}
          onHoldOut={onHoldOut}
        />
        <SheetAngleRow
          label="다리"
          range="0 - 40도"
          angle={footAngle}
          keys={['footMinus', 'footPlus']}
          pressing={pressingButton}
          deltaDisabled={deltaDisabled}
          onHoldIn={onHoldIn}
          onHoldOut={onHoldOut}
        />
      </View>

      {/* 버튼 */}
      <View style={styles.actions}>
        <RippleButton
          style={[styles.actionPrimary, actionsDisabled && styles.actionDisabled]}
          rippleColor={color['on-ink']}
          onPress={onMove}
          disabled={actionsDisabled}
        >
          <Image source={require('../../assets/icons/tab-pose.svg')} style={styles.actionIconPrimary} />
          <Text style={styles.actionPrimaryText}>이 각도로 침대 움직이기</Text>
        </RippleButton>
        {isError ? (
          <RippleButton
            style={[styles.actionSecondary, retryDisabled && styles.actionDisabled]}
            onPress={onRetry}
            disabled={retryDisabled}
          >
            <Text style={styles.actionSecondaryText}>다시 시도</Text>
          </RippleButton>
        ) : (
          <RippleButton
            style={[styles.actionSecondary, isSaved && styles.actionSecondarySaved, actionsDisabled && !isSaved && !isSaving && styles.actionDisabled]}
            onPress={onSaveOnly}
            disabled={actionsDisabled || isSaving || isSaved}
          >
            {isSaving ? (
              <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
            ) : (
              <Image
                source={require('../../assets/images/save-angle.png')}
                style={[styles.actionIconSecondary, isSaved && styles.actionIconSecondarySaved]}
                contentFit="contain"
              />
            )}
            <Text style={[styles.actionSecondaryText, isSaved && styles.actionSecondaryTextSaved]}>
              {isSaving ? (waitKind === 'delete' ? '삭제 중…' : '저장 중…') : isSaved ? '저장되었어요' : '각도만 저장 (침대는 그대로)'}
            </Text>
          </RippleButton>
        )}
        {isError && (
          <RippleButton style={styles.actionCancel} onPress={onCancel}>
            <Text style={styles.actionCancelText}>취소</Text>
          </RippleButton>
        )}
        {(isError || !!note) && (
          <Text style={styles.saveNote}>{isError ? '연결이 원활하지 않아요. 다시 시도해 주세요' : note}</Text>
        )}
        <DeleteRow show={hasDefaultAngle} disabled={actionsDisabled} onPress={onDeleteSaved} />
      </View>
    </BottomSheet>
  );
}

const sctlStyles = StyleSheet.create({
  row: {
    height: 84,
    borderRadius: 24,
    backgroundColor: '#F0EAE6',
    position: 'relative',
  },
  nameGroup: {
    position: 'absolute',
    left: 20,
    top: 23,
  },
  name: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#2D2220',
  },
  range: {
    fontSize: 15,
    fontFamily: font.medium,
    lineHeight: 18,
    color: '#705A54',
  },
  // 시안 .ctl: 오른쪽 안쪽 여백 12에 붙은 칸들(52 · 96 · 52, 사이 4). 기기가 넓어지면 이름 칸만 넓어진다
  hold: { top: 16 },
  holdBtnLeft: {
    right: 12 + 52 + 4 + 96 + 4,
  },
  holdBtnRight: {
    right: 12,
  },

  valGroup: {
    position: 'absolute',
    right: 12 + 52 + 4,
    width: 96,
    top: 19,
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  valNum: {
    fontSize: 46,
    fontFamily: font.extraLight,
    letterSpacing: -1.84,
    color: '#2D2220',
    lineHeight: 46,
  },



});

const styles = StyleSheet.create({



  // 손잡이


  // 헤더
  shead: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: font.bold,
    lineHeight: 30,
    letterSpacing: -0.48,
    color: '#2D2220',
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0EAE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLine: {
    position: 'absolute',
    width: 17,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#2D2220',
  },
  // 자세 탭
  purposeTabs: {
    height: 52,
    flexDirection: 'row',
    gap: 6,
  },
  purposeBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#F0EAE6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeBtnActive: {
    backgroundColor: '#342724',
  },
  purposeText: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 20,
    textAlign: 'center',
    color: '#2D2220',
  },
  purposeTextActive: {
    color: '#FFFAF7',
  },
  // 상태 라벨
  pair: {
    height: 18,
    flexDirection: 'row',
    gap: 16,
  },
  pairText: {
    fontSize: 15,
    fontFamily: font.medium,
    lineHeight: 18,
    color: '#705A54',
  },
  saveNote: {
    fontSize: 15,
    fontFamily: font.semiBold,
    color: '#AD332C',
    textAlign: 'center',
  },
  pairTextSaved: {
    fontFamily: font.bold,
    color: '#2D2220',
  },
  // 미리보기
  preview: {
    overflow: 'hidden',
    // 시안: 갤럭시는 세로가 짧아 각도 시트가 스크롤되지 않게 미리보기만 78로 줄인다
    height: Platform.OS === 'android' ? 78 : 116,
    backgroundColor: '#F0EAE6',
    borderRadius: 24,
  },
  // 각도 조절 카드
  // 시안 .sheet .sctl: 흰 바탕 그대로(그림자 없음)
  sctl: {
    backgroundColor: '#FFFCFA',
    borderRadius: 26,
    gap: 8,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  // 버튼
  actions: {
    gap: 8,
  },
  actionPrimary: {
    height: 60,
    backgroundColor: '#342724',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionIconPrimary: {
    width: 22,
    height: 22,
    tintColor: '#FFFAF7',
  },
  actionPrimaryText: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 20,
    color: '#FFFAF7',
  },
  actionSecondary: {
    height: 60,
    backgroundColor: '#ECB0A0',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionIconSecondary: {
    width: 22,
    height: 22,
    tintColor: '#2D2220',
  },
  actionSecondarySaved: {
    backgroundColor: '#342724',
  },
  actionIconSecondarySaved: {
    tintColor: '#FFFAF7',
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#2D2220',
    borderRightColor: 'transparent',
  },
  actionSecondaryText: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 20,
    color: '#2D2220',
  },
  actionSecondaryTextSaved: {
    color: '#FFFAF7',
  },
  actionCancel: {
    height: 60,
    backgroundColor: '#F0EAE6',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCancelText: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 20,
    color: '#2D2220',
  },
  deleteBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 20,
    color: '#AD332C',
    textDecorationLine: 'underline',
  },
});