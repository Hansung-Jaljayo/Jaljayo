import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keepAll } from '@/components/ObScreen';
import { boardUrl, setBoardUrl, useBoardStatus } from '@/features/bed/boardLink';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';
import { PullScroll } from '@/components/PullScroll';

interface Props {
  visible?: boolean;
  isRegistered?: boolean;
  isConnected?: boolean;
  // 침대 상태를 읽는 중(초기화·이름·밤 시간을 막는다)
  isLoading?: boolean;
  // 병원용 침대면 이름 바꾸기·밤 시간 줄을 보인다
  isWard?: boolean;
  contact?: string;
  bedName?: string;
  bedStatus?: string;
  appVersion?: string;
  firmwareVersion?: string;
  onClose?: () => void;
  onRenameBed?: () => void;
  onNightTime?: () => void;
  onUnregister?: () => void;
  onReregister?: () => void;
  onResetBed?: () => void;
  onPrivacyPolicy?: () => void;
  onTerms?: () => void;
  onOpenSource?: () => void;
  onHospitalAdmin?: () => void;
}

const BOARD_STATUS = { open: '연결됨', trying: '연결 중', none: '주소 없음' };

function BoardAddress() {
  const status = useBoardStatus();
  const [text, setText] = useState(() => boardUrl());
  return (
    <View style={styles.actionsCard}>
      <View style={[styles.actionRow, styles.actionRowBorder]}>
        <Text style={styles.actionText}>보드 주소</Text>
        <Text style={styles.boardStatus}>{BOARD_STATUS[status]}</Text>
      </View>
      <View style={styles.actionRow}>
        <TextInput
          style={styles.boardInput}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => setBoardUrl(text)}
          onEndEditing={() => setBoardUrl(text)}
          placeholder="예: 192.168.0.10"
          placeholderTextColor="#705A54"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          accessibilityLabel="보드 주소"
        />
      </View>
    </View>
  );
}

export default function SettingsScreen({
  visible = false,
  isRegistered = true,
  isConnected = true,
  isLoading = false,
  isWard = false,
  contact = '문의 이메일 준비 중',
  bedName = '잘자요 침대',
  bedStatus = '연결됨 · 이 폰으로 조작 중',
  appVersion = '1.0.0 (시안)',
  firmwareVersion,
  onClose,
  onRenameBed,
  onNightTime,
  onUnregister,
  onReregister,
  onResetBed,
  onPrivacyPolicy,
  onTerms,
  onOpenSource,
  onHospitalAdmin,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showReregisterDialog, setShowReregisterDialog] = useState(false);
  const [showUnregisterDialog, setShowUnregisterDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const busy = !isConnected || isLoading;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* ihead · 설정 머리 */}
        <View style={styles.ihead}>
          <RippleButton style={styles.backBtn} onPress={onClose}>
            <View style={styles.chevronLeft} />
          </RippleButton>
          <Text style={styles.title}>설정</Text>
        </View>

        {/* sbody */}
        <PullScroll
          style={styles.sbody}
          contentContainerStyle={styles.sbodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 침대 섹션 — 등록된 경우에만 표시 */}
          {isRegistered && (
            <>
              <Text style={[styles.sectionLabel, styles.sectionLabelTop]}>침대</Text>

              {/* bedrow · 침대 줄 */}
              <View style={styles.bedrow}>
                <Image
                  source={require('../../assets/images/bed.png')}
                  style={styles.bedImg}
                  contentFit="contain"
                />
                <View style={styles.bedInfo}>
                  <Text style={styles.bedName}>{bedName}</Text>
                  <Text style={styles.bedSubStatus}>{bedStatus}</Text>
                </View>
              </View>

              {/* 보드 주소: 같은 와이파이에 있는 보드에 연결한다 */}
              <BoardAddress />

              {/* actions · 버튼 묶음 */}
              <View style={styles.actionsCard}>
                {isWard && (
                  <RippleButton
                    style={[styles.actionRow, styles.actionRowBorder, busy && styles.actionRowDisabled]}
                    onPress={onRenameBed}
                    disabled={busy}
                  >
                    <Text style={styles.actionText}>부르는 이름 바꾸기</Text>
                    <View style={styles.actionChevron} />
                  </RippleButton>
                )}
                {isWard && (
                  <RippleButton
                    style={[styles.actionRow, styles.actionRowBorder, busy && styles.actionRowDisabled]}
                    onPress={onNightTime}
                    disabled={busy}
                  >
                    <Text style={styles.actionText}>밤 시간</Text>
                    <View style={styles.actionChevron} />
                  </RippleButton>
                )}
                <RippleButton
                  style={[styles.actionRow, styles.actionRowBorder]}
                  onPress={() => setShowReregisterDialog(true)}
                >
                  <Text style={styles.actionText}>다시 등록</Text>
                </RippleButton>
                <RippleButton
                  style={[styles.actionRow, styles.actionRowBorder]}
                  onPress={() => setShowUnregisterDialog(true)}
                >
                  <Text style={styles.actionText}>등록 해제</Text>
                </RippleButton>
                <RippleButton
                  style={[styles.actionRow, busy && styles.actionRowDisabled]}
                  rippleColor="#AD332C"
                  onPress={() => setShowResetDialog(true)}
                  disabled={busy}
                >
                  <Text style={styles.actionTextWarn}>침대 초기화</Text>
                </RippleButton>
              </View>

              {/* hint */}
              <Text style={styles.hint}>
                {keepAll(isConnected
                  ? `등록 해제는 이 폰의 연결만 끊어요.\n침대에 저장된 알람과 예약은 지워지지 않아요.\n침대 초기화는 침대에서 알람, 예약, 자세 기록을 모두 지워요.`
                  : `침대와 연결이 끊겨 있어요. 침대 초기화는 다시 연결된 뒤에 할 수 있어요.`)}
              </Text>
            </>
          )}

          {/* 앱 섹션 */}
          <Text style={[styles.sectionLabel, isRegistered ? styles.sectionLabelApp : styles.sectionLabelTop]}>앱</Text>

          {/* ilist · 설정 목록 */}
          <View style={styles.ilist}>
            <View style={[styles.irow, styles.irowBorder]}>
              <View style={styles.irowInfo}>
                <Text style={styles.irowLabel}>앱 버전</Text>
                <Text style={styles.irowValue}>{appVersion}</Text>
              </View>
            </View>
            {(firmwareVersion !== undefined || !isRegistered || !isConnected) && (
              <View style={[styles.irow, styles.irowBorder]}>
                <View style={styles.irowInfo}>
                  <Text style={styles.irowLabel}>침대 프로그램 버전</Text>
                  <Text style={styles.irowValue}>
                    {!isRegistered ? '등록된 침대 없음' : !isConnected ? '연결 안 됨' : firmwareVersion}
                  </Text>
                </View>
              </View>
            )}
            {/* 문의 주소는 글자로 보여 준다(누르는 줄 아님) */}
            <View style={styles.irow}>
              <View style={styles.irowInfo}>
                <Text style={styles.irowLabel}>문의하기</Text>
                <Text style={styles.irowValue} selectable>{contact}</Text>
              </View>
            </View>
          </View>

          {/* 약관 글 */}
          {(onPrivacyPolicy || onTerms || onOpenSource) && (
            <View style={[styles.ilist, styles.ilistGap]}>
              {onPrivacyPolicy && (
                <RippleButton
                  style={[styles.irow, styles.irowBorder]}
                  onPress={onPrivacyPolicy}
                >
                  <Text style={[styles.irowLabel, styles.irowLabelFlex]}>개인정보처리방침</Text>
                  <Image source={require('../../assets/icons/chevron.svg')} style={styles.irowChevron} />
                </RippleButton>
              )}
              {onTerms && (
                <RippleButton
                  style={[styles.irow, styles.irowBorder]}
                  onPress={onTerms}
                >
                  <Text style={[styles.irowLabel, styles.irowLabelFlex]}>이용약관</Text>
                  <Image source={require('../../assets/icons/chevron.svg')} style={styles.irowChevron} />
                </RippleButton>
              )}
              {onOpenSource && (
                <RippleButton style={styles.irow} onPress={onOpenSource}>
                  <Text style={[styles.irowLabel, styles.irowLabelFlex]}>오픈소스 라이선스</Text>
                  <Image source={require('../../assets/icons/chevron.svg')} style={styles.irowChevron} />
                </RippleButton>
              )}
            </View>
          )}

          {/* 병원 섹션 */}
          {onHospitalAdmin && (
            <>
              <Text style={[styles.sectionLabel, styles.sectionLabelApp]}>병원</Text>
              <View style={styles.ilist}>
                <RippleButton style={styles.irow} onPress={onHospitalAdmin}>
                  <Text style={[styles.irowLabel, styles.irowLabelFlex]}>병원 관리 (직원용)</Text>
                  <Image source={require('../../assets/icons/chevron.svg')} style={styles.irowChevron} />
                </RippleButton>
              </View>
            </>
          )}
        </PullScroll>

      </View>
      <Modal transparent visible={showReregisterDialog} animationType="fade" onRequestClose={() => setShowReregisterDialog(false)}>
        <View style={styles.dlg}>
          <View style={styles.dbox}>
            <Text style={styles.dlgTitle}>침대를 다시 등록할까요?</Text>
            <Text style={styles.dlgBody}>침대 QR을 다시 찍어 이 폰에 연결해요. 알람과 예약은 그대로예요.</Text>
            <View style={styles.dacts}>
              <RippleButton
                style={styles.dactCancel}
                onPress={() => setShowReregisterDialog(false)}
              >
                <Text style={styles.dactCancelText}>취소</Text>
              </RippleButton>
              <RippleButton rippleColor="#FFFAF7"
                style={styles.dactConfirm}
                onPress={() => { setShowReregisterDialog(false); onReregister?.(); }}
              >
                <Text style={styles.dactConfirmText}>QR 찍기</Text>
              </RippleButton>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={showUnregisterDialog} animationType="fade" onRequestClose={() => setShowUnregisterDialog(false)}>
        <View style={styles.dlg}>
          <View style={styles.dbox}>
            <Text style={[styles.dlgTitle, styles.dlgCenter]}>등록을 해제할까요?</Text>
            <Text style={[styles.dlgBody, styles.dlgCenter]}>
              {isConnected
                ? '이 폰으로는 더 이상 침대를 조작할 수 없어요.\n침대에 저장된 알람과 예약은 지워지지 않아요.'
                : '침대와 연결이 끊겨 있어 이 폰에 남은 연결 정보만 지워요.\n침대에 저장된 알람과 예약은 지워지지 않아요.'}
            </Text>
            <View style={styles.dacts}>
              <RippleButton
                style={styles.dactCancel}
                onPress={() => setShowUnregisterDialog(false)}
              >
                <Text style={styles.dactCancelText}>취소</Text>
              </RippleButton>
              <RippleButton rippleColor="#FFFAF7"
                style={styles.dactConfirm}
                onPress={() => { setShowUnregisterDialog(false); onUnregister?.(); }}
              >
                <Text style={styles.dactConfirmText}>등록 해제</Text>
              </RippleButton>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={showResetDialog} animationType="fade" onRequestClose={() => setShowResetDialog(false)}>
        <View style={styles.dlg}>
          <View style={styles.dbox}>
            <Text style={[styles.dlgTitle, styles.dlgCenter]}>침대를 초기화할까요?</Text>
            <Text style={[styles.dlgBody, styles.dlgCenter]}>침대에서 알람, 예약, 자세 기록을 모두 지워요.</Text>
            <View style={styles.dacts}>
              <RippleButton style={styles.dactCancel} onPress={() => setShowResetDialog(false)}>
                <Text style={styles.dactCancelText}>취소</Text>
              </RippleButton>
              <RippleButton rippleColor="#FFFAF7"
                style={[styles.dactConfirm, styles.dactDanger]}
                onPress={() => { setShowResetDialog(false); if (!busy) onResetBed?.(); }}
              >
                <Text style={styles.dactConfirmText}>초기화</Text>
              </RippleButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },

  // ihead · 설정 머리
  ihead: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronLeft: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: '#2D2220',
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  title: {
    fontSize: 20,
    fontFamily: font.bold,
    lineHeight: 25,
    color: '#2D2220',
  },

  // sbody
  sbody: {
    flex: 1,
  },
  sbodyContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 24,
  },

  // 섹션 레이블
  sectionLabel: {
    fontSize: 15,
    fontFamily: font.bold,
    lineHeight: 18,
    color: '#705A54',
    marginBottom: 12,
  },
  // 시안: 묶음 사이 12 + 소제목 위 8
  sectionLabelApp: {
    marginTop: 20,
  },
  sectionLabelTop: {
    marginTop: 8,
  },

  // bedrow · 침대 줄
  bedrow: {
    height: 76,
    backgroundColor: '#F0EAE6',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 12,
  },
  bedImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  bedInfo: {
    gap: 0,
  },
  bedName: {
    fontSize: 20,
    fontFamily: font.bold,
    lineHeight: 24,
    color: '#2D2220',
  },
  bedSubStatus: {
    fontSize: 15,
    fontFamily: font.medium,
    lineHeight: 18,
    color: '#705A54',
  },

  // actions · 버튼 묶음
  actionsCard: {
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actionRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
  },
  actionText: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#2D2220',
  },
  actionTextWarn: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#AD332C',
  },

  boardStatus: { marginLeft: 'auto', fontSize: 15, fontFamily: font.medium, color: '#705A54' },
  boardInput: { flex: 1, height: 56, fontSize: 17, fontFamily: font.medium, color: '#2D2220' },

  actionRowDisabled: {
    opacity: 0.45,
  },
  // 시안 [data-cs-name]::after: 선 2px짜리 8칸 네모를 45도 돌린 화살표
  actionChevron: {
    marginLeft: 'auto',
    marginRight: 4,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#705A54',
    transform: [{ rotate: '45deg' }],
  },

  // hint
  hint: {
    fontSize: 15,
    fontFamily: font.regular,
    lineHeight: 22,
    color: '#705A54',
    marginBottom: 0,
  },

  // ilist · 설정 목록
  ilistGap: {
    marginTop: 12,
  },
  ilist: {
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
    overflow: 'hidden',
  },
  irow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 16,
    gap: 8,
  },
  irowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
  },
  // 시안 .irow: 이름은 왼쪽, 값은 같은 줄 오른쪽
  irowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  irowLabel: {
    fontSize: 17,
    fontFamily: font.semiBold,
    lineHeight: 20,
    color: '#2D2220',
  },
  irowLabelFlex: {
    flex: 1,
  },
  irowValue: {
    fontSize: 15,
    fontFamily: font.medium,
    lineHeight: 18,
    color: '#705A54',
  },
  irowChevron: {
    width: 20,
    height: 20,
  },

  // 확인 팝업 공통
  dlgCenter: {
    textAlign: 'center',
  },

  // 다시 등록 확인 팝업
  dlg: {
    flex: 1,
    backgroundColor: 'rgba(28, 20, 18, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dbox: {
    width: 312,
    backgroundColor: '#FFFCFA',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 8,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 8,
  },
  dlgTitle: {
    fontSize: 20,
    fontFamily: font.bold,
    lineHeight: 24,
    color: '#2D2220',
  },
  dlgBody: {
    fontSize: 15,
    fontFamily: font.regular,
    lineHeight: 22,
    color: '#705A54',
  },
  dacts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dactCancel: {
    flex: 1,
    height: 56,
    backgroundColor: '#F0EAE6',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dactCancelText: {
    fontSize: 17,
    fontFamily: font.semiBold,
    color: '#2D2220',
  },
  dactConfirm: {
    flex: 1,
    height: 56,
    backgroundColor: '#342724',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dactDanger: {
    backgroundColor: '#AD332C',
  },
  dactConfirmText: {
    fontSize: 17,
    fontFamily: font.semiBold,
    color: '#FFFAF7',
  },
});