import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { balance, bySentence, keepAll, OB_EDGES } from '@/components/ObScreen';
import { font } from '@/theme/tokens';
import { RippleButton } from '@/components/RippleButton';

interface Props {
  ssid: string;
  error?: boolean;
  onConnect?: (password: string) => void;
  onBack?: () => void;
}

export default function WifiPasswordScreen({ ssid, error, onConnect, onBack }: Props) {
  const [password, setPassword] = useState('');
  // 틀렸다는 안내는 다시 입력하기 시작하면 지운다(다시 들어올 때마다 화면을 새로 그려 error를 읽는다)
  const [bad, setBad] = useState(!!error);

  const [visible, setVisible] = useState(false);
  // 입력칸을 누르고 있는 동안 테두리를 복숭아색으로(시안 .field input:focus)
  const [focused, setFocused] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={OB_EDGES}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={styles.title}>{keepAll(balance('비밀번호를 입력해 주세요'))}</Text>
            <Text style={styles.lead}>{keepAll(bySentence(ssid))}</Text>

            {/* field · 이름표, 입력칸, 틀렸다는 줄(사이 8) */}
            <View style={styles.field}>
            <Text style={styles.label}>와이파이 비밀번호</Text>
            <View style={[styles.inputRow, focused && styles.inputRowFocus, bad && styles.inputRowError]}>
              <TextInput
                style={styles.input}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                accessibilityLabel="와이파이 비밀번호"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!visible}
                value={password}
                onChangeText={(t) => { setPassword(t); setBad(false); }}
              />
              {/* 눈 아이콘: 물결 없이 누르는 동안 바탕과 그림 색만 바뀐다(시안 .eye:active) */}
              <Pressable
                style={({ pressed }) => [styles.eyeButton, pressed && styles.eyePressed]}
                onPress={() => setVisible(v => !v)}
                accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
                accessibilityState={{ selected: visible }}
              >
                {({ pressed }) => (
                  <Image
                    source={visible
                      ? require('../../assets/images/eye-open.png')
                      : require('../../assets/images/eye-closed.png')
                    }
                    style={[styles.eyeIcon, pressed && styles.eyeIconPressed]}
                    resizeMode="contain"
                  />
                )}
              </Pressable>
            </View>
            {bad && (
              <Text style={styles.errorText}>비밀번호가 맞지 않아요. 다시 입력해 주세요.</Text>
            )}
            </View>
          </View>

          <View style={styles.actions}>
            <RippleButton rippleColor="#FFFAF7"
              style={[styles.primaryButton, !password && styles.primaryButtonDisabled]}
              onPress={() => password && onConnect?.(password)}
              disabled={!password}
            >
              <Text style={styles.primaryText}>연결</Text>
            </RippleButton>
            <RippleButton style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryText}>다른 와이파이 고르기</Text>
            </RippleButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
  },
  keyboardView: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    justifyContent: 'space-between',
  },
  top: {
    gap: 16,
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontFamily: font.bold,
    letterSpacing: Platform.OS === 'ios' ? -0.9 : -0.72,
    color: '#2D2220',
    lineHeight: Platform.OS === 'ios' ? 37.5 : 30,
  },
  lead: {
    fontSize: 17,
    fontFamily: font.regular,
    lineHeight: 25.5,
    color: '#513E39',
  },
  field: {
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCFA',
    borderRadius: 16,
    // 시안 .field input: 테두리 2 #e2d8d3, 그림자 없음
    borderWidth: 2,
    borderColor: '#E2D8D3',
  },
  inputRowFocus: {
    borderColor: '#D9816D',
  },
  inputRowError: {
    borderColor: '#AD332C',
  },
  input: {
    flex: 1,
    height: 56,
    paddingLeft: 16,
    // 글자는 눈 버튼 앞 56에서 끝난다(시안 padding-right: 56 = 6 + 버튼 48 + 2)
    paddingRight: 6,
    fontSize: 17,
    fontFamily: font.regular,
    color: '#2D2220',
  },
  // 입력칸 오른쪽 안 48칸 버튼(테두리 2 안쪽에서 오른쪽 2, 위 2 = 시안 right 4, top 4)
  eyeButton: {
    width: 48,
    height: 48,
    marginRight: 2,
    borderRadius: 12,
  },
  eyePressed: {
    backgroundColor: '#F0EAE6',
  },
  eyeIcon: {
    width: 48,
    height: 48,
  },
  eyeIconPressed: {
    tintColor: '#2D2220',
  },
  errorText: {
    fontSize: 15,
    fontFamily: font.semiBold,
    color: '#AD332C',
    lineHeight: 18,
  },
  links: {
    flexDirection: 'row',
  },
  link: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    height: 48,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 17,
    fontFamily: font.bold,
    textDecorationLine: 'underline',
    color: '#513E39',
    lineHeight: 20,
  },
  primaryButton: {
    height: 60,
    backgroundColor: '#342724',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontFamily: font.bold,
    color: '#513E39',
  },
  actions: {
    gap: 8,
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFCFA',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  secondaryText: {
    fontSize: 17,
    fontFamily: font.bold,
    color: '#2D2220',
    lineHeight: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#D8CCC6',
  },
  primaryText: {
    fontSize: 20,
    fontFamily: font.bold,
    color: '#FFFAF7',
    lineHeight: 24,
  },
});