import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { RippleButton, useRipple } from '@/components/RippleButton';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { Fade } from '@/components/Fade';
import { TabTop } from '@/components/TabTop';
import { useColorAnim } from '@/components/useColorAnim';
import { color, font, cssEase } from '@/theme/tokens';
import { PullScroll } from '@/components/PullScroll';
import { BedView } from '@/features/pose/BedView';

// 시안 CSS ease
const EASE = Easing.bezier(...cssEase);

// 밤 안내 줄의 달 그림
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFAF7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';

const PRESETS = [
  { label: '독서', icon: require('../../assets/images/preset-reading.png') },
  { label: 'TV', icon: require('../../assets/images/preset-tv.png') },
  { label: '휴식', icon: require('../../assets/images/preset-rest.png') },
  { label: '잠', icon: require('../../assets/images/preset-sleep.png') },
];

export type HoldKey = 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';

interface Props {
  // 3D 침대에 보낼 지금 각도(소수점까지, 움직이는 동안 매 장면 바뀐다)
  bedHead?: number;
  bedLeg?: number;
  // 침대가 움직이는 중(3D 페이지가 스스로 움직인다)
  bedMoving?: boolean;
  headAngle?: number;
  footAngle?: number;
  activePreset?: number;
  isLoading?: boolean;
  isDisconnected?: boolean;
  // 움직이는 중 표시(±를 누르는 중이거나 1.2초 이상 걸리는 움직임)
  isMoving?: boolean;
  // 아래 멈춤 버튼(자세 버튼으로 움직일 때만)
  showStop?: boolean;
  pressingButton?: HoldKey;
  holdDisabled?: (b: HoldKey) => boolean;
  // 자세 버튼·기본 각도 수정 줄을 막는다
  controlsDisabled?: boolean;
  showUndo?: boolean;
  undoDisabled?: boolean;
  onGear?: () => void;
  onHoldIn?: (b: HoldKey) => void;
  onHoldOut?: (b: HoldKey) => void;
  onPreset?: (index: number) => void;
  onEditPresets?: () => void;
  onStop?: () => void;
  onUndo?: () => void;
  // 병원용 밤 시간 안내 한 줄
  nightNote?: string;
  // 밤 안내 줄을 읽어 줄 때 쓰는 긴 글
  nightLabel?: string;
}

// ± 버튼(시안 .hold): 누르는 동안 짙은 바탕 + 0.94배(0.1초), 막히면 바탕·그림자를 없앤다. 물결은 없다
export function HoldButton({
  kind,
  active,
  disabled,
  style,
  onIn,
  onOut,
  label,
}: {
  kind: 'plus' | 'minus';
  active: boolean;
  disabled: boolean;
  style?: StyleProp<ViewStyle>;
  onIn?: () => void;
  onOut?: () => void;
  label: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    // 바탕색과 같은 칸에서 움직이므로 둘 다 JS로 움직인다(한 칸에 기기·JS 움직임을 섞으면 오류)
    Animated.timing(scale, { toValue: active ? 0.94 : 1, duration: 100, easing: EASE, useNativeDriver: false }).start();
  }, [active, scale]);
  const ic = active ? color.accent : disabled ? color.disabled : color.fg;
  // 바탕색은 0.15초 동안 바뀐다(시안 .hold transition: background .15s). 막히면 바탕이 투명해지고 그림자는 바로 없어진다
  const bg = useColorAnim(active ? color.ink : disabled ? 'rgba(255, 252, 250, 0)' : color.card, 150);
  return (
    <Animated.View style={[holdStyles.btn, style, disabled && !active && holdStyles.off, { backgroundColor: bg, transform: [{ scale }] }]}>
      <Pressable
        style={holdStyles.hit}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled && !active}
        accessibilityLabel={label}
        role="button"
      >
        <View style={[holdStyles.h, { backgroundColor: ic }]} />
        {kind === 'plus' && <View style={[holdStyles.v, { backgroundColor: ic }]} />}
      </Pressable>
    </Animated.View>
  );
}

// 바뀐 값이 없으면 다시 그리지 않는다(누르는 동안 숫자가 바뀐 줄만 다시 그린다)
const AngleRow = memo(function AngleRow({
  label,
  range,
  angle,
  keys,
  pressing,
  minusDisabled,
  plusDisabled,
  onHoldIn,
  onHoldOut,
}: {
  label: string;
  range: string;
  angle: number;
  keys: readonly [HoldKey, HoldKey];
  pressing?: HoldKey;
  minusDisabled: boolean;
  plusDisabled: boolean;
  onHoldIn: (b: HoldKey) => void;
  onHoldOut: (b: HoldKey) => void;
}) {
  const [minus, plus] = keys;
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.nameGroup}>
        <Text style={rowStyles.name}>{label}</Text>
        <Text style={rowStyles.range}>{range}</Text>
      </View>
      <HoldButton
        kind="minus"
        label={`${label} 내리기`}
        style={rowStyles.holdBtnLeft}
        active={pressing === minus}
        disabled={minusDisabled}
        onIn={() => onHoldIn(minus)}
        onOut={() => onHoldOut(minus)}
      />
      <View style={rowStyles.valGroup}>
        <Text style={rowStyles.valNum}>{angle}</Text>
        <Text style={rowStyles.valDeg}>°</Text>
      </View>
      <HoldButton
        kind="plus"
        label={`${label} 올리기`}
        style={rowStyles.holdBtnRight}
        active={pressing === plus}
        disabled={plusDisabled}
        onIn={() => onHoldIn(plus)}
        onOut={() => onHoldOut(plus)}
      />
    </View>
  );
});

const HEAD_KEYS = ['headMinus', 'headPlus'] as const;
const FOOT_KEYS = ['footMinus', 'footPlus'] as const;

// 부모가 다시 그려져도 같은 함수를 넘긴다(안에서는 늘 마지막으로 받은 함수를 부른다). 아래 칸들이 다시 그려지지 않게 한다
function useStable<A extends unknown[]>(fn: ((...a: A) => void) | undefined) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...a: A) => ref.current?.(...a), []);
}

const TopRow = memo(TabTop);

// 자세별 기본 각도 수정 버튼
const EditLong = memo(function EditLong({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <RippleButton
      style={[styles.editLong, disabled && styles.editLongDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Image
        source={require('../../assets/images/adjust.png')}
        style={[styles.editIcon, disabled && { tintColor: '#C4B6B0' }]}
        contentFit="contain"
      />
      <Text style={[styles.editText, disabled && styles.editTextDisabled]}>자세별 기본 각도 수정</Text>
      <Image
        source={disabled ? require('../../assets/icons/chevron-off-22.svg') : require('../../assets/icons/chevron-fg2-22.svg')}
        style={styles.editChevron}
      />
    </RippleButton>
  );
});

// 자세 버튼 줄과 멈춤 버튼. 자세 버튼 줄은 0.2초 동안 사라지고, 멈춤 버튼은 0.25초 동안 8 아래에서 올라온다(시안 .moving)
const Dock = memo(function Dock({
  showStop,
  activePreset,
  disabled,
  onPreset,
  onStop,
}: {
  showStop: boolean;
  activePreset: number;
  disabled: boolean;
  onPreset: (i: number) => void;
  onStop: () => void;
}) {
  const [swap] = useState(() => new Animated.Value(showStop ? 1 : 0));
  const [stopIn] = useState(() => new Animated.Value(showStop ? 1 : 0));
  useEffect(() => {
    Animated.timing(swap, { toValue: showStop ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true }).start();
    Animated.timing(stopIn, { toValue: showStop ? 1 : 0, duration: 250, easing: EASE, useNativeDriver: true }).start();
  }, [showStop, swap, stopIn]);
  const [presetsOpacity] = useState(() => swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const [stopY] = useState(() => stopIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }));
  return (
    <View style={styles.dock}>
      <Animated.View style={[styles.presets, { opacity: presetsOpacity }]} pointerEvents={showStop ? 'none' : 'auto'}>
        {PRESETS.map(({ label, icon }, index) => (
          <PresetButton
            key={label}
            label={label}
            icon={icon}
            isActive={index === activePreset}
            disabled={disabled}
            onPress={() => onPreset(index)}
          />
        ))}
      </Animated.View>
      <Animated.View
        style={[styles.stopWrap, { opacity: stopIn, transform: [{ translateY: stopY }] }]}
        pointerEvents={showStop ? 'auto' : 'none'}
      >
        <RippleButton style={styles.stopBtn} rippleColor={color.white} onPress={onStop} accessibilityLabel="멈춤">
          <View style={styles.stopIcon} />
          <Text style={styles.stopText}>멈춤</Text>
        </RippleButton>
      </Animated.View>
    </View>
  );
});

const CIRCLE = { borderRadius: 30 };

// 자세 버튼: 누르면 동그라미 안에서만 물결이 퍼진다(시안 2717)
function PresetButton({
  label,
  icon,
  isActive,
  disabled,
  onPress,
}: {
  label: string;
  icon: number;
  isActive: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { host: rpHost, onLayout: rpLayout, start: rpStart, end: rpEnd, layer: rpLayer } = useRipple(isActive ? color.accent : color['fg-2'], CIRCLE);
  // 동그라미 바탕과 그림 색은 0.2초 동안 바뀐다(시안 .preset .ic transition: background .2s, color .2s)
  const bg = useColorAnim(disabled ? (isActive ? '#D8CCC6' : '#F0EAE6') : isActive ? '#342724' : '#FFFCFA', 200);
  const tint = useColorAnim(disabled ? (isActive ? '#FFFAF7' : '#C4B6B0') : isActive ? '#ECB0A0' : '#513E39', 200);
  return (
    <Pressable
      style={styles.preset}
      onPress={onPress}
      onPressIn={rpStart}
      onPressOut={rpEnd}
      disabled={disabled}
      accessibilityLabel={label}
      role="button"
    >
      <Animated.View
        ref={rpHost}
        onLayout={rpLayout}
        style={[styles.presetBtn, disabled && styles.presetBtnFlat, { backgroundColor: bg }]}
      >
        <Animated.Image source={icon} style={[styles.presetIcon, { tintColor: tint }]} resizeMode="contain" />
        {rpLayer}
      </Animated.View>
      {/* 막힌 동안에도 고른 자세 이름은 굵게 둔다(시안: .preset.on 굵기 + :disabled 흐린 색) */}
      <Text style={[styles.presetLabel, isActive ? styles.presetLabelOn : styles.presetLabelOff, disabled && styles.presetLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

// 움직이는 중 표시의 점: 1초마다 옅어졌다 돌아온다(시안 blink)
function BlinkDot({ on }: { on: boolean }) {
  const [op] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!on) {
      op.stopAnimation();
      op.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.3, duration: 500, easing: EASE, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 500, easing: EASE, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, op]);
  return <Animated.View style={[styles.chipDot, on && styles.chipDotMoving, { opacity: op }]} />;
}

export default function PostureScreen({
  bedHead = 45,
  bedLeg = 15,
  bedMoving = false,
  headAngle = 45,
  footAngle = 45,
  activePreset = 0,
  isLoading = false,
  isMoving = false,
  showStop = false,
  pressingButton,
  holdDisabled,
  controlsDisabled = false,
  showUndo = false,
  undoDisabled = false,
  onGear,
  onHoldIn,
  onHoldOut,
  onPreset,
  onEditPresets,
  onStop,
  onUndo,
  nightNote,
  nightLabel,
}: Props) {
  const holdIn = useStable(onHoldIn);
  const holdOut = useStable(onHoldOut);
  const preset = useStable(onPreset);
  const stop = useStable(onStop);
  const editPresets = useStable(onEditPresets);
  // 화면에 남는 높이로 사진 칸 높이를 정한다. 나머지 칸 높이(bodyH - heroH)는 사진 칸과 상관없어 한 번에 맞는다
  const [viewH, setViewH] = useState(0);
  const [bodyH, setBodyH] = useState(0);
  const [heroH, setHeroH] = useState(HERO_MAX);
  if (viewH && bodyH) {
    const fit = Math.round(Math.min(HERO_MAX, Math.max(HERO_MIN, viewH - TAB_BAR_SPACE - (bodyH - heroH))));
    if (Math.abs(fit - heroH) > 0.5) setHeroH(fit);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 끝까지 당기면 아이폰은 튕기고 갤럭시는 늘어난다 */}
      <PullScroll
        style={styles.fill}
        contentContainerStyle={styles.inner}
        scrollEnabled={!pressingButton}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
      >
        {/* 사진 칸 높이는 화면에 남는 만큼(최대 240). 작은 화면에서는 줄어들어 자세 버튼까지 탭에 가리지 않고 다 들어간다 */}
        <View onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
        {/* Header */}
        <TopRow onGear={onGear} />

        {/* Hero */}
        {/* 불러오는 중에는 위 줄을 뺀 칸이 0.2초 동안 흐려지고 막힌다(시안 .loading) */}
        <Fade on={isLoading}>
        <View style={[styles.hero, { height: heroH }]}>
          {/* 3D 침대: 시점 고정, 침대만 지금 각도로 움직인다 */}
          <BedView head={bedHead} leg={bedLeg} moving={bedMoving} />
          {/* 시안: 밤 안내 줄은 사진 칸 왼쪽 위에 얹는다 */}
          {!!nightNote && (
            <View style={styles.nightNote} role="status" accessible accessibilityLabel={nightLabel}>
              <SvgXml xml={MOON} width={16} height={16} />
              <Text style={styles.nightNoteText}>{nightNote}</Text>
            </View>
          )}
          <View style={[styles.chip, isMoving && styles.chipMoving]}>
            <BlinkDot on={isMoving} />
            <Text style={[styles.chipText, isMoving && styles.chipTextMoving]}>{isMoving ? '움직이는 중' : '멈춤'}</Text>
          </View>
          {showUndo && (
            <RippleButton
              style={[styles.undoBtn, undoDisabled && styles.undoBtnDisabled]}
              onPress={onUndo}
              disabled={undoDisabled}
              accessibilityLabel="되돌리기"
            >
              <Image
                source={require('../../assets/images/undo.png')}
                style={[styles.undoIcon, undoDisabled && styles.undoIconDisabled]}
                contentFit="contain"
              />
              <Text style={[styles.undoText, undoDisabled && styles.undoTextDisabled]}>되돌리기</Text>
            </RippleButton>
          )}
        </View>
        </Fade>

        {/* Angle Card */}
        <Fade on={isLoading}>
        <View style={styles.card}>
          <AngleRow
            label="머리"
            range="0 - 60도"
            angle={headAngle}
            keys={HEAD_KEYS}
            pressing={pressingButton}
            minusDisabled={!!holdDisabled?.('headMinus')}
            plusDisabled={!!holdDisabled?.('headPlus')}
            onHoldIn={holdIn}
            onHoldOut={holdOut}
          />
          <AngleRow
            label="다리"
            range="0 - 40도"
            angle={footAngle}
            keys={FOOT_KEYS}
            pressing={pressingButton}
            minusDisabled={!!holdDisabled?.('footMinus')}
            plusDisabled={!!holdDisabled?.('footPlus')}
            onHoldIn={holdIn}
            onHoldOut={holdOut}
          />
        </View>
        </Fade>

        {/* Edit Presets Button */}
        <Fade on={isLoading}>
          <EditLong disabled={controlsDisabled} onPress={editPresets} />
        </Fade>

        {/* Preset Buttons / Stop Button */}
        <Fade on={isLoading}>
        <Dock
          showStop={showStop}
          activePreset={activePreset}
          disabled={controlsDisabled}
          onPreset={preset}
          onStop={stop}
        />
        </Fade>
        </View>
      </PullScroll>
    </SafeAreaView>
  );
}

const holdStyles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 13,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFCFA',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  off: { shadowOpacity: 0, elevation: 0 },
  h: { position: 'absolute', width: 10, height: 2, borderRadius: 1 },
  v: { position: 'absolute', width: 2, height: 10, borderRadius: 1 },
});

const rowStyles = StyleSheet.create({
  row: {
    height: 78,
    borderRadius: 24,
    backgroundColor: '#F0EAE6',
    position: 'relative',
  },
  nameGroup: {
    position: 'absolute',
    left: 20,
    top: 21.5,
  },
  name: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#2D2220',
  },
  range: {
    fontSize: 13,
    fontFamily: font.medium,
    lineHeight: 16,
    color: '#705A54',
  },

  holdBtnLeft: {
    left: 84,
  },
  holdBtnRight: {
    right: 13,
  },

  valGroup: {
    position: 'absolute',
    left: 136,
    right: 65,
    top: 16,
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
  valDeg: {
    fontSize: 20,
    fontFamily: font.light,
    letterSpacing: -1.84,
    color: '#705A54',
    lineHeight: 20,
    marginTop: 4,
  },



});

const HERO_MAX = 240;
const HERO_MIN = 120;

const styles = StyleSheet.create({
  // 시안 .nightnote: 높이 32, 반투명 어두운 바탕, 13 글자
  nightNote: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(29, 22, 20, 0.62)',
  },
  nightNoteText: { fontSize: 13, fontFamily: font.semiBold, color: '#FFFAF7' },
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  fill: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: TAB_BAR_SPACE,
  },
  // Hero
  // 시안: 아이폰 240, 갤럭시 184. 실제 높이는 화면 크기로 정한다(HERO_MAX 이하)
  hero: {
    marginTop: 8,
    borderRadius: 34,
    backgroundColor: '#342724',
    overflow: 'hidden',
  },
  chip: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: '#624943',
    borderRadius: 17,
  },
  undoBtn: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 14,
    gap: 6,
    backgroundColor: '#FFFCFA',
    borderRadius: 17,
    shadowColor: '#1D1614',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  undoBtnDisabled: {
    backgroundColor: '#4A3530',
    shadowOpacity: 0,
    elevation: 0,
  },
  undoIcon: {
    width: 16,
    height: 16,
    tintColor: '#2D2220',
  },
  undoIconDisabled: {
    tintColor: '#7A5E58',
  },
  undoText: {
    fontSize: 13,
    fontFamily: font.bold,
    lineHeight: 16,
    color: '#2D2220',
  },
  undoTextDisabled: {
    color: '#7A5E58',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EAD9D2',
  },
  chipDotMoving: {
    backgroundColor: '#2D2220',
  },
  chipText: {
    fontSize: 13,
    fontFamily: font.semiBold,
    lineHeight: 16,
    color: '#FFFAF7',
  },
  chipMoving: {
    backgroundColor: '#ECB0A0',
  },
  chipTextMoving: {
    color: '#2D2220',
  },
  // Card
  card: {
    marginTop: 8,
    backgroundColor: '#FFFCFA',
    borderRadius: 30,
    padding: 10,
    gap: 8,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  // Edit presets
  editLong: {
    marginTop: 8,
    height: 52,
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 16,
    gap: 12,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  editIcon: {
    width: 22,
    height: 22,
  },
  editText: {
    flex: 1,
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#2D2220',
  },
  editChevron: {
    width: 22,
    height: 22,
  },
  editLongDisabled: {
    backgroundColor: '#F0EAE6',
    shadowOpacity: 0,
    elevation: 0,
  },
  editTextDisabled: {
    color: '#B3A6A1',
  },
  // Presets
  presets: {
    marginTop: 8,
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  presetBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFCFA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  presetIcon: {
    width: 24,
    height: 24,
  },
  // 막힌 자세 버튼은 그림자가 없다(시안 .preset:disabled .ic box-shadow: none)
  presetBtnFlat: {
    shadowOpacity: 0,
    elevation: 0,
  },
  presetLabel: {
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  presetLabelOn: {
    fontFamily: font.bold,
    color: '#2D2220',
  },
  presetLabelOff: {
    fontFamily: font.medium,
    color: '#513E39',
  },
  presetLabelDisabled: {
    color: '#B3A6A1',
  },
  dock: {
    marginTop: 8,
    height: 91,
  },
  // 시안 .dock .stop-l: 자세 버튼 줄 위에 겹쳐 놓는다(좌우 4, 위 4)
  stopWrap: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
  },
  stopBtn: {
    height: 60,
    backgroundColor: '#AD332C',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#AD332C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  stopText: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#FFFFFF',
  },

});