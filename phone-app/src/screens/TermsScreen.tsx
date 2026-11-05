import InfoDocScreen, { DocSection } from './InfoDocScreen';

const SECTIONS: DocSection[] = [
  {
    heading: '목적',
    text: '이 약관은 잘자요 팀이 제공하는 잘자요 앱을 이용하는 조건과 절차를 정해요.',
  },
  {
    heading: '서비스 내용',
    text: '잘자요 앱은 잘자요 침대 모듈과 연결해 자세를 조절하고 알람·예약을 설정하고 확인하는 앱이에요. 침대는 앱 없이도 말과 침대 버튼으로 쓸 수 있어요.',
  },
  {
    heading: '이용 조건',
    text: '앱을 쓰려면 잘자요 침대 모듈이 있어야 하고, 같은 와이파이 네트워크에 연결돼 있어야 해요.',
  },
  {
    heading: '안전하게 쓰기',
    items: [
      '침대를 움직이기 전에 침대 주변과 아래에 사람이나 물건이 없는지 확인하세요.',
      '움직임을 멈추려면 멈춤 버튼이나 침대 버튼을 누르거나 "멈춰"라고 말해 주세요.',
    ],
  },
  {
    heading: '서비스 변경과 중단',
    text: '앱의 기능은 바뀌거나 중단될 수 있어요. 중요한 변경이 있으면 앱 공지로 알려드려요.',
  },
  {
    heading: '책임의 한계',
    text: '와이파이 연결이 끊기면 앱으로 침대를 조작할 수 없어요. 이 경우 침대는 하던 움직임을 멈추도록 만들어져 있어요.',
  },
];

interface Props {
  visible?: boolean;
  onClose?: () => void;
}

export default function TermsScreen({ visible, onClose }: Props) {
  return (
    <InfoDocScreen
      visible={visible}
      title="이용약관"
      sections={SECTIONS}
      onClose={onClose}
    />
  );
}