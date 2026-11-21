import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keepAll } from '@/components/ObScreen';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';
import { PullScroll } from '@/components/PullScroll';

export type DocSection = {
  heading: string;
  text?: string;
  items?: string[];
};

interface Props {
  visible?: boolean;
  title: string;
  sections: DocSection[];
  onClose?: () => void;
}

export default function InfoDocScreen({ visible = false, title, sections, onClose }: Props) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* ihead */}
        <View style={styles.ihead}>
          <RippleButton style={styles.backBtn} onPress={onClose}>
            <View style={styles.chevronLeft} />
          </RippleButton>
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* ibody */}
        <PullScroll
          style={styles.ibody}
          contentContainerStyle={styles.ibodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.draft}>시안용 예시 문구 · 법률 검토 전</Text>

          {sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.h3}>{section.heading}</Text>
              {section.text && <Text style={styles.p}>{keepAll(section.text)}</Text>}
              {section.items && (
                <View style={styles.ul}>
                  {section.items.map((item, j) => (
                    <View key={j} style={styles.li}>
                      <View style={styles.liMarker} />
                      <Text style={styles.liText}>{keepAll(item)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </PullScroll>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },

  // ihead
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

  // ibody
  ibody: {
    flex: 1,
  },
  ibodyContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 16,
  },

  // draft
  draft: {
    fontSize: 13,
    fontFamily: font.semiBold,
    lineHeight: 16,
    color: '#705A54',
  },

  // doc sections
  section: {
    gap: 4,
  },
  h3: {
    fontSize: 17,
    fontFamily: font.bold,
    lineHeight: 21,
    color: '#2D2220',
  },
  p: {
    fontSize: 15,
    fontFamily: font.regular,
    lineHeight: 22,
    color: '#513E39',
  },

  // ul / li
  ul: {
    gap: 0,
  },
  li: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  liMarker: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#513E39',
    marginTop: 9,
  },
  liText: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.regular,
    lineHeight: 22,
    color: '#513E39',
  },
});