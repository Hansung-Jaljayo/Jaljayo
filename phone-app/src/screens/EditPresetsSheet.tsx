import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const PRESET_LABELS = ['독서', 'TV', '휴식', '잠'];

interface Props {
  visible?: boolean;
  activePreset?: number;
  headAngle?: number;
  footAngle?: number;
  defaultAngleLabel?: string;
  lastUsedLabel?: string;
  pressingButton?: 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';
  isSaving?: boolean;
  isSaved?: boolean;
  hasDefaultAngle?: boolean;
  isError?: boolean;
  onClose?: () => void;
  onSelectPreset?: (index: number) => void;
  onHeadMinusPressIn?: () => void;
  onHeadMinusPressOut?: () => void;
  onHeadPlusPressIn?: () => void;
  onHeadPlusPressOut?: () => void;
  onFootMinusPressIn?: () => void;
  onFootMinusPressOut?: () => void;
  onFootPlusPressIn?: () => void;
  onFootPlusPressOut?: () => void;
  onMoveAndSave?: () => void;
  onSaveOnly?: () => void;
  onDeleteSaved?: () => void;
  onRetry?: () => void;
}

function SheetAngleRow({
  label,
  range,
  angle,
  disabled,
  activeSide,
  onMinusPressIn,
  onMinusPressOut,
  onPlusPressIn,
  onPlusPressOut,
}: {
  label: string;
  range: string;
  angle: number;
  disabled?: boolean;
  activeSide?: 'plus' | 'minus';
  onMinusPressIn?: () => void;
  onMinusPressOut?: () => void;
  onPlusPressIn?: () => void;
  onPlusPressOut?: () => void;
}) {
  const isPlusActive = activeSide === 'plus';
  const isMinusActive = activeSide === 'minus';
  const isPlusDisabled = disabled || isMinusActive;
  const isMinusDisabled = disabled || isPlusActive;

  const plusIconColor = isPlusActive ? '#ECB0A0' : isPlusDisabled ? '#C4B6B0' : '#2D2220';
  const minusIconColor = isMinusActive ? '#ECB0A0' : isMinusDisabled ? '#C4B6B0' : '#2D2220';

  return (
    <View style={sctlStyles.row}>
      <View style={sctlStyles.nameGroup}>
        <Text style={sctlStyles.name}>{label}</Text>
        <Text style={sctlStyles.range}>{range}</Text>
      </View>
      <TouchableOpacity
        style={[sctlStyles.holdBtn, sctlStyles.holdBtnLeft, isMinusActive && sctlStyles.holdBtnActive]}
        onPressIn={onMinusPressIn}
        onPressOut={onMinusPressOut}
        disabled={isMinusDisabled}
      >
        <View style={[sctlStyles.minusLine, { backgroundColor: minusIconColor }]} />
      </TouchableOpacity>
      <View style={sctlStyles.valGroup}>
        <Text style={sctlStyles.valNum}>{angle}</Text>
        <Text style={sctlStyles.valDeg}>°</Text>
      </View>
      <TouchableOpacity
        style={[sctlStyles.holdBtn, sctlStyles.holdBtnRight, isPlusActive && sctlStyles.holdBtnActive]}
        onPressIn={onPlusPressIn}
        onPressOut={onPlusPressOut}
        disabled={isPlusDisabled}
      >
        <View style={[sctlStyles.plusH, { backgroundColor: plusIconColor }]} />
        <View style={[sctlStyles.plusV, { backgroundColor: plusIconColor }]} />
      </TouchableOpacity>
    </View>
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
  isSaving = false,
  isSaved = false,
  hasDefaultAngle = false,
  isError = false,
  onClose,
  onSelectPreset,
  onHeadMinusPressIn,
  onHeadMinusPressOut,
  onHeadPlusPressIn,
  onHeadPlusPressOut,
  onFootMinusPressIn,
  onFootMinusPressOut,
  onFootPlusPressIn,
  onFootPlusPressOut,
  onMoveAndSave,
  onSaveOnly,
  onDeleteSaved,
  onRetry,
}: Props) {
  const isAnyPressing = !!pressingButton;
  const isBlocked = isAnyPressing || isSaving || isError;

  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isSaving) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotation.stopAnimation();
      rotation.setValue(0);
    }
  }, [isSaving]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* 손잡이 */}
          <View style={styles.grab}>
            <View style={styles.grabBar} />
          </View>

          {/* 헤더 */}
          <View style={styles.shead}>
            <Text style={styles.title}>자세별 기본 각도 수정</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <View style={[styles.xLine, { transform: [{ rotate: '45deg' }] }]} />
              <View style={[styles.xLine, { transform: [{ rotate: '-45deg' }] }]} />
            </TouchableOpacity>
          </View>

          {/* 자세 탭 */}
          <View style={styles.purposeTabs}>
            {PRESET_LABELS.map((label, i) => (
              <TouchableOpacity
                key={label}
                style={[styles.purposeBtn, i === activePreset && styles.purposeBtnActive]}
                onPress={() => onSelectPreset?.(i)}
              >
                <Text style={[styles.purposeText, i === activePreset && styles.purposeTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 상태 라벨 */}
          <View style={styles.pair}>
            <Text style={[styles.pairText, (isSaved || hasDefaultAngle) && styles.pairTextSaved]}>{defaultAngleLabel}</Text>
            <Text style={styles.pairText}>{lastUsedLabel}</Text>
          </View>

          {/* 미리보기 */}
          <View style={styles.preview} />

          {/* 각도 조절 카드 */}
          <View style={styles.sctl}>
            <SheetAngleRow
              label="머리"
              range="0 - 60도"
              angle={headAngle}
              disabled={isSaving || (isAnyPressing && pressingButton !== 'headPlus' && pressingButton !== 'headMinus')}
              activeSide={pressingButton === 'headPlus' ? 'plus' : pressingButton === 'headMinus' ? 'minus' : undefined}
              onMinusPressIn={onHeadMinusPressIn}
              onMinusPressOut={onHeadMinusPressOut}
              onPlusPressIn={onHeadPlusPressIn}
              onPlusPressOut={onHeadPlusPressOut}
            />
            <SheetAngleRow
              label="다리"
              range="0 - 40도"
              angle={footAngle}
              disabled={isSaving || (isAnyPressing && pressingButton !== 'footPlus' && pressingButton !== 'footMinus')}
              activeSide={pressingButton === 'footPlus' ? 'plus' : pressingButton === 'footMinus' ? 'minus' : undefined}
              onMinusPressIn={onFootMinusPressIn}
              onMinusPressOut={onFootMinusPressOut}
              onPlusPressIn={onFootPlusPressIn}
              onPlusPressOut={onFootPlusPressOut}
            />
          </View>

          {/* 버튼 */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionPrimary, isBlocked && styles.actionDisabled]}
              onPress={onMoveAndSave}
              disabled={isBlocked}
            >
              <Image
                source={require('../../assets/images/tab-posture.png')}
                style={styles.actionIconPrimary}
                resizeMode="contain"
              />
              <Text style={styles.actionPrimaryText}>이 각도로 침대 움직이기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionSecondary,
                isSaved && styles.actionSecondarySaved,
                isAnyPressing && !isSaved && !isError && styles.actionDisabled,
              ]}
              onPress={isError ? onRetry : onSaveOnly}
              disabled={isAnyPressing || isSaving || isSaved}
            >
              {isSaving ? (
                <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
              ) : !isError && !isSaved ? (
                <Image
                  source={require('../../assets/images/save-angle.png')}
                  style={styles.actionIconSecondary}
                  resizeMode="contain"
                />
              ) : isSaved ? (
                <Image
                  source={require('../../assets/images/save-angle.png')}
                  style={[styles.actionIconSecondary, styles.actionIconSecondarySaved]}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={[styles.actionSecondaryText, isSaved && styles.actionSecondaryTextSaved]}>
                {isSaving ? '저장 중…' : isSaved ? '저장되었어요' : isError ? '다시 시도' : '각도만 저장 (침대는 그대로)'}
              </Text>
            </TouchableOpacity>
            {isError && (
              <TouchableOpacity style={styles.actionCancel} onPress={onClose}>
                <Text style={styles.actionCancelText}>취소</Text>
              </TouchableOpacity>
            )}
            {(isSaved || hasDefaultAngle) && (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDeleteSaved}>
                <Text style={styles.deleteBtnText}>저장한 각도 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
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
    fontWeight: '600',
    lineHeight: 20,
    color: '#2D2220',
  },
  range: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    color: '#705A54',
  },
  holdBtn: {
    position: 'absolute',
    top: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFCFA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  holdBtnLeft: {
    left: 104,
  },
  holdBtnRight: {
    left: 260,
  },
  holdBtnActive: {
    backgroundColor: '#342724',
    shadowOpacity: 0.26,
    transform: [{ scale: 0.94 }],
  },
  valGroup: {
    position: 'absolute',
    left: 160,
    width: 96,
    top: 19,
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  valNum: {
    fontSize: 46,
    fontWeight: '200',
    letterSpacing: -1.84,
    color: '#2D2220',
    lineHeight: 46,
  },
  valDeg: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: -1.84,
    color: '#705A54',
    lineHeight: 20,
    marginTop: 4,
  },
  minusLine: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  plusH: {
    position: 'absolute',
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: 10,
    borderRadius: 1,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28, 20, 18, 0.55)',
  },
  sheet: {
    backgroundColor: '#FFFCFA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 16,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  // 손잡이
  grab: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 44,
    height: 5,
    backgroundColor: '#CBBDB7',
    borderRadius: 3,
  },
  // 헤더
  shead: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
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
    width: 12,
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
    fontWeight: '700',
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
    fontWeight: '500',
    lineHeight: 18,
    color: '#705A54',
  },
  pairTextSaved: {
    fontWeight: '700',
    color: '#2D2220',
  },
  // 미리보기
  preview: {
    height: 78,
    backgroundColor: '#F0EAE6',
    borderRadius: 24,
  },
  // 각도 조절 카드
  sctl: {
    backgroundColor: '#FFFCFA',
    borderRadius: 26,
    gap: 8,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    lineHeight: 20,
    color: '#AD332C',
    textDecorationLine: 'underline',
  },
});