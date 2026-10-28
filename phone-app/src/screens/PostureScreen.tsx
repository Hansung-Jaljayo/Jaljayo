import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRESETS = [
  { label: '독서', icon: require('../../assets/images/preset-reading.png') },
  { label: 'TV', icon: require('../../assets/images/preset-tv.png') },
  { label: '휴식', icon: require('../../assets/images/preset-rest.png') },
  { label: '잠', icon: require('../../assets/images/preset-sleep.png') },
];

interface Props {
  bedName?: string;
  headAngle?: number;
  footAngle?: number;
  activePreset?: number;
  isLoading?: boolean;
  isDisconnected?: boolean;
  showDisconnectDialog?: boolean;
  isMoving?: boolean;
  pressingButton?: 'headPlus' | 'headMinus' | 'footPlus' | 'footMinus';
  showUndo?: boolean;
  undoDisabled?: boolean;
  onGear?: () => void;
  onHeadMinusPressIn?: () => void;
  onHeadMinusPressOut?: () => void;
  onHeadPlusPressIn?: () => void;
  onHeadPlusPressOut?: () => void;
  onFootMinusPressIn?: () => void;
  onFootMinusPressOut?: () => void;
  onFootPlusPressIn?: () => void;
  onFootPlusPressOut?: () => void;
  onPreset?: (index: number) => void;
  onEditPresets?: () => void;
  onStop?: () => void;
  onUndo?: () => void;
  onDismissDisconnectDialog?: () => void;
  onTabChange?: (tab: string) => void;
}

function AngleRow({
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
    <View style={rowStyles.row}>
      <View style={rowStyles.nameGroup}>
        <Text style={rowStyles.name}>{label}</Text>
        <Text style={rowStyles.range}>{range}</Text>
      </View>
      <TouchableOpacity
        style={[rowStyles.holdBtn, rowStyles.holdBtnLeft, isMinusActive && rowStyles.holdBtnActive]}
        onPressIn={onMinusPressIn}
        onPressOut={onMinusPressOut}
        disabled={isMinusDisabled}
      >
        <View style={[rowStyles.minusLine, { backgroundColor: minusIconColor }]} />
      </TouchableOpacity>
      <View style={rowStyles.valGroup}>
        <Text style={rowStyles.valNum}>{angle}</Text>
        <Text style={rowStyles.valDeg}>°</Text>
      </View>
      <TouchableOpacity
        style={[rowStyles.holdBtn, rowStyles.holdBtnRight, isPlusActive && rowStyles.holdBtnActive]}
        onPressIn={onPlusPressIn}
        onPressOut={onPlusPressOut}
        disabled={isPlusDisabled}
      >
        <View style={[rowStyles.plusH, { backgroundColor: plusIconColor }]} />
        <View style={[rowStyles.plusV, { backgroundColor: plusIconColor }]} />
      </TouchableOpacity>
    </View>
  );
}

export default function PostureScreen({
  bedName = '잘자요',
  headAngle = 45,
  footAngle = 45,
  activePreset = 0,
  isLoading = false,
  isDisconnected = false,
  showDisconnectDialog = false,
  isMoving = false,
  pressingButton,
  showUndo = false,
  undoDisabled = false,
  onGear,
  onHeadMinusPressIn,
  onHeadMinusPressOut,
  onHeadPlusPressIn,
  onHeadPlusPressOut,
  onFootMinusPressIn,
  onFootMinusPressOut,
  onFootPlusPressIn,
  onFootPlusPressOut,
  onPreset,
  onEditPresets,
  onStop,
  onUndo,
  onDismissDisconnectDialog,
  onTabChange,
}: Props) {
  const isAnyPressing = !!pressingButton;
  const showMovingChip = isMoving || isAnyPressing;
  const isControlsDisabled = isLoading || isDisconnected || isMoving || isAnyPressing;
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.top}>
          <View style={styles.who}>
            <Image
              source={require('../../assets/images/bed.png')}
              style={styles.bedThumb}
              resizeMode="contain"
            />
            <View style={styles.whoText}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, isDisconnected && styles.statusDotDisconnected]} />
                <Text style={styles.statusLabel}>
                  {isDisconnected ? '연결 끊김' : isLoading ? '불러오는 중' : '연결됨'}
                </Text>
              </View>
              <Text style={styles.bedName}>{bedName}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.gearBtn} onPress={onGear}>
            <Image
              source={require('../../assets/images/gear.png')}
              style={styles.gearIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={[styles.hero, isLoading && styles.sectionDisabled]}>
          <View style={[styles.chip, showMovingChip && styles.chipMoving]}>
            <View style={[styles.chipDot, showMovingChip && styles.chipDotMoving]} />
            <Text style={[styles.chipText, showMovingChip && styles.chipTextMoving]}>
              {showMovingChip ? '움직이는 중' : '멈춤'}
            </Text>
          </View>
          {showUndo && !showMovingChip && (
            <TouchableOpacity
              style={[styles.undoBtn, undoDisabled && styles.undoBtnDisabled]}
              onPress={onUndo}
              disabled={undoDisabled}
            >
              <Image
                source={require('../../assets/images/undo.png')}
                style={[styles.undoIcon, undoDisabled && styles.undoIconDisabled]}
                resizeMode="contain"
              />
              <Text style={[styles.undoText, undoDisabled && styles.undoTextDisabled]}>되돌리기</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Angle Card */}
        <View style={[styles.card, isLoading && styles.sectionDisabled]}>
          <AngleRow
            label="머리"
            range="0 - 60도"
            angle={headAngle}
            disabled={isMoving || (isAnyPressing && pressingButton !== 'headPlus' && pressingButton !== 'headMinus')}
            activeSide={pressingButton === 'headPlus' ? 'plus' : pressingButton === 'headMinus' ? 'minus' : undefined}
            onMinusPressIn={onHeadMinusPressIn}
            onMinusPressOut={onHeadMinusPressOut}
            onPlusPressIn={onHeadPlusPressIn}
            onPlusPressOut={onHeadPlusPressOut}
          />
          <AngleRow
            label="다리"
            range="0 - 60도"
            angle={footAngle}
            disabled={isMoving || (isAnyPressing && pressingButton !== 'footPlus' && pressingButton !== 'footMinus')}
            activeSide={pressingButton === 'footPlus' ? 'plus' : pressingButton === 'footMinus' ? 'minus' : undefined}
            onMinusPressIn={onFootMinusPressIn}
            onMinusPressOut={onFootMinusPressOut}
            onPlusPressIn={onFootPlusPressIn}
            onPlusPressOut={onFootPlusPressOut}
          />
        </View>

        {/* Edit Presets Button */}
        <TouchableOpacity
          style={[styles.editLong, isControlsDisabled && styles.editLongDisabled, isLoading && styles.sectionDisabled]}
          onPress={onEditPresets}
          disabled={isControlsDisabled}
        >
          <Image
            source={require('../../assets/images/adjust.png')}
            style={[styles.editIcon, isControlsDisabled && { tintColor: '#C4B6B0' }]}
            resizeMode="contain"
          />
          <Text style={[styles.editText, isControlsDisabled && styles.editTextDisabled]}>자세별 기본 각도 수정</Text>
          <Text style={[styles.editChevron, isControlsDisabled && styles.editChevronDisabled]}>›</Text>
        </TouchableOpacity>

        {/* Preset Buttons / Stop Button */}
        {isMoving ? (
          <View style={[styles.dock, isLoading && styles.sectionDisabled]}>
            <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
              <View style={styles.stopIcon} />
              <Text style={styles.stopText}>멈춤</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.presets, isLoading && styles.sectionDisabled]}>
            {PRESETS.map(({ label, icon }, index) => {
              const isActive = index === activePreset;
              return (
                <TouchableOpacity
                  key={label}
                  style={styles.preset}
                  onPress={() => onPreset?.(index)}
                  disabled={isControlsDisabled}
                >
                  <View
                    style={[
                      styles.presetBtn,
                      !isControlsDisabled && isActive && styles.presetBtnOn,
                      isControlsDisabled && isActive && styles.presetBtnOnDisabled,
                      isControlsDisabled && !isActive && styles.presetBtnOffDisabled,
                    ]}
                  >
                    {icon && (
                      <Image
                        source={icon}
                        style={[
                          styles.presetIcon,
                          !isControlsDisabled && isActive && styles.presetIconOn,
                          !isControlsDisabled && !isActive && styles.presetIconOff,
                          isControlsDisabled && isActive && styles.presetIconActive,
                          isControlsDisabled && !isActive && styles.presetIconDisabled,
                        ]}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.presetLabel,
                      isControlsDisabled
                        ? styles.presetLabelDisabled
                        : isActive ? styles.presetLabelOn : styles.presetLabelOff,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.spacer} />

        {/* Bottom Tabs */}
        <View style={styles.tabs}>
          {([
            { label: '자세', icon: require('../../assets/images/tab-posture.png') },
            { label: '알람', icon: require('../../assets/images/tab-alarm.png') },
            { label: '예약', icon: require('../../assets/images/tab-reservation.png') },
          ] as const).map(({ label, icon }, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.tab, i === 0 && styles.tabActive]}
              onPress={() => onTabChange?.(label)}
            >
              <Image source={icon} style={[styles.tabIcon, i === 0 && styles.tabIconOn]} resizeMode="contain" />
              <Text style={[styles.tabLabel, i === 0 && styles.tabLabelOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Disconnect Dialog */}
      {showDisconnectDialog && (
        <View style={dlgStyles.overlay}>
          <View style={dlgStyles.box}>
            <Text style={dlgStyles.title}>연결이 끊겨 조작을 멈췄어요</Text>
            <Text style={dlgStyles.body}>침대와 다시 연결되면 다시 조작할 수 있어요</Text>
            <TouchableOpacity style={dlgStyles.confirmBtn} onPress={onDismissDisconnectDialog}>
              <Text style={dlgStyles.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const dlgStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28, 20, 18, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  box: {
    backgroundColor: '#FFFCFA',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    color: '#2D2220',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: '#705A54',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmBtn: {
    height: 56,
    backgroundColor: '#342724',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
    color: '#FFFAF7',
  },
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
    fontWeight: '600',
    lineHeight: 20,
    color: '#2D2220',
  },
  range: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    color: '#705A54',
  },
  holdBtn: {
    position: 'absolute',
    top: 13,
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
    left: 84,
  },
  holdBtnRight: {
    right: 13,
  },
  holdBtnActive: {
    backgroundColor: '#342724',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 4,
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
    backgroundColor: '#2D2220',
    borderRadius: 1,
  },
  plusH: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: '#2D2220',
    borderRadius: 1,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: 10,
    backgroundColor: '#2D2220',
    borderRadius: 1,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 18,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  // Header
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    marginTop: 6,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bedThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  whoText: {
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D9816D',
  },
  statusDotDisconnected: {
    backgroundColor: '#AD332C',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    color: '#705A54',
  },
  bedName: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 24,
    color: '#2D2220',
  },
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFCFA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  gearIcon: {
    width: 22,
    height: 22,
  },
  // Hero
  hero: {
    height: 184,
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
    lineHeight: 20,
    color: '#2D2220',
  },
  editChevron: {
    fontSize: 20,
    color: '#513E39',
  },
  editLongDisabled: {
    backgroundColor: '#F0EAE6',
    shadowOpacity: 0,
    elevation: 0,
  },
  editTextDisabled: {
    color: '#B3A6A1',
  },
  editChevronDisabled: {
    color: '#C4B6B0',
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
  presetIconOn: {
    tintColor: '#ECB0A0',  // 활성: 다크 배경 위 살몬
  },
  presetIconOff: {
    tintColor: '#705A54',  // 비활성: 흰 배경 위 브라운
  },
  presetIconActive: {
    tintColor: '#FFFAF7',  // 비활성화 + 활성
  },
  presetIconDisabled: {
    tintColor: '#C4B6B0',  // 누르는 중 + 비활성
  },
  presetBtnOn: {
    backgroundColor: '#342724',
  },
  presetBtnOnDisabled: {
    backgroundColor: '#D8CCC6',
  },
  presetBtnOffDisabled: {
    backgroundColor: '#F0EAE6',
  },
  presetLabel: {
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  presetLabelOn: {
    fontWeight: '700',
    color: '#2D2220',
  },
  presetLabelOff: {
    fontWeight: '500',
    color: '#513E39',
  },
  presetLabelDisabled: {
    fontWeight: '500',
    color: '#B3A6A1',
  },
  dock: {
    marginTop: 8,
    height: 91,
  },
  stopBtn: {
    marginHorizontal: 4,
    marginTop: 4,
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
    fontWeight: '600',
    lineHeight: 20,
    color: '#FFFFFF',
  },
  spacer: {
    flex: 1,
  },
  // Bottom tabs
  tabs: {
    height: 68,
    backgroundColor: '#FFFCFA',
    borderRadius: 34,
    marginBottom: 8,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 26,
  },
  tabActive: {
    backgroundColor: '#342724',
  },
  tabIcon: {
    width: 22,
    height: 22,
    tintColor: '#705A54',
  },
  tabIconOn: {
    tintColor: '#ECB0A0',
  },
  tabIconPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.8,
    borderColor: '#705A54',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
    color: '#705A54',
  },
  tabLabelOn: {
    color: '#FFFAF7',
  },
});