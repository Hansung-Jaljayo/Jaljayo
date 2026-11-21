import InfoDocScreen, { DocSection } from './InfoDocScreen';

const SECTIONS: DocSection[] = [
  {
    heading: "수집하는 개인정보",
    text: "잘자요 앱은 회원가입이 없고, 이름·전화번호·이메일·위치 같은 개인정보를 수집하지 않아요.",
  },
  {
    heading: "앱이 쓰는 기기 권한",
    items: [
      "카메라: 침대 모듈의 QR 코드를 읽을 때만 써요. 사진은 저장하거나 보내지 않아요.",
      "로컬 네트워크: 같은 와이파이에 있는 침대를 찾고 연결할 때 써요.",
    ],
  },
  {
    heading: "침대에 저장되는 정보",
    text: "알람, 자세 예약, 자세 각도 기록은 침대 모듈 안에만 저장돼요. 앱은 침대에 저장된 내용을 받아 보여 주기만 하고, 외부 서버로 보내지 않아요.",
  },
  {
    heading: "음성",
    text: "음성 명령은 침대 모듈 안에서 처리하고 외부로 보내지 않아요.",
  },
  {
    heading: "다른 곳에 주거나 맡기는 정보",
    text: "다른 회사나 기관에 정보를 제공하거나 처리를 맡기지 않아요.",
  },
  {
    heading: "보관과 삭제",
    text: "앱을 지우면 앱에 남은 침대 연결 정보가 함께 지워져요. 침대에 저장된 기록은 앱의 설정 > 침대 초기화로 지울 수 있어요.",
  },
  {
    heading: "안전하게 지키는 방법",
    text: "QR로 등록한 폰 한 대만 침대를 조작할 수 있어요. 다른 폰으로 다시 등록하면 이전 폰은 더 이상 조작할 수 없어요.",
  },
  {
    heading: "문의",
    text: "잘자요 팀 · 문의 이메일 준비 중",
  },
  {
    heading: "시행일",
    text: "2026년 10월 12일",
  },
];

interface Props {
  visible?: boolean;
  onClose?: () => void;
}

export default function PrivacyPolicyScreen({ visible, onClose }: Props) {
  return (
    <InfoDocScreen
      visible={visible}
      title="개인정보처리방침"
      sections={SECTIONS}
      onClose={onClose}
    />
  );
}