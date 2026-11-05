import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  ssid: string;
  error?: boolean;
  onConnect?: (password: string) => void;
  onBack?: () => void;
}

export default function WifiPasswordScreen({ ssid, error, onConnect, onBack }: Props) {
  const [password, setPassword] = useState('');

  const [visible, setVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={styles.title}>비밀번호를 입력해 주세요</Text>
            <Text style={styles.lead}>{ssid}</Text>

            <View style={[styles.inputRow, error && styles.inputRowError]}>
              <TextInput
                style={styles.input}
                placeholder="와이파이 비밀번호"
                placeholderTextColor="#CBBDB7"
                secureTextEntry={!visible}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setVisible(v => !v)}>
                <Image
                  source={visible
                    ? require('../../assets/images/eye-open.png')
                    : require('../../assets/images/eye-closed.png')
                  }
                  style={styles.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
            {error && (
              <Text style={styles.errorText}>비밀번호가 맞지 않아요. 다시 입력해 주세요</Text>
            )}

            <View style={styles.links}>
              <TouchableOpacity style={styles.link} onPress={onBack}>
                <Text style={styles.linkText}>다른 와이파이 고르기</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (!password || error) && styles.primaryButtonDisabled]}
            onPress={() => password && !error && onConnect?.(password)}
            disabled={!password || !!error}
          >
            <Text style={styles.primaryText}>연결</Text>
          </TouchableOpacity>
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
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  top: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.72,
    color: '#2D2220',
    lineHeight: 30,
  },
  lead: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 20,
    color: '#2D2220',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCFA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  inputRowError: {
    borderColor: '#AD332C',
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 18,
    fontSize: 17,
    fontWeight: '500',
    color: '#2D2220',
  },
  eyeButton: {
    paddingHorizontal: 14,
    height: 56,
    justifyContent: 'center',
  },
  eyeIcon: {
    width: 34,
    height: 34,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '700',
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
  primaryButtonDisabled: {
    backgroundColor: '#D8CCC6',
  },
  primaryText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFAF7',
    lineHeight: 24,
  },
});