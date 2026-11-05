import InfoDocScreen, { DocSection } from './InfoDocScreen';

const SECTIONS: DocSection[] = [
  {
    heading: 'Noto Sans KR',
    text: 'Copyright Google LLC.\nSIL Open Font License 1.1',
  },
  {
    heading: 'Pretendard',
    text: 'Copyright Kil Hyung-jin.\nSIL Open Font License 1.1',
  },
];

interface Props {
  visible?: boolean;
  onClose?: () => void;
}

export default function OpenSourceScreen({ visible, onClose }: Props) {
  return (
    <InfoDocScreen
      visible={visible}
      title="오픈소스 라이선스"
      sections={SECTIONS}
      onClose={onClose}
    />
  );
}