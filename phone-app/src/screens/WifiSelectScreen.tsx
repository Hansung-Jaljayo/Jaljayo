import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  networks: string[];
  onSelect?: (ssid: string) => void;
  onRescan?: () => void;
  onHome?: () => void;
}

export default function WifiSelectScreen({ networks, onSelect, onRescan, onHome }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title}>와이파이를 골라 주세요</Text>
          <Text style={styles.lead}>침대가 앞으로 연결할 와이파이예요.</Text>

          {networks.length === 0 ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                {'주변 와이파이를 찾지 못했어요. 공유기 전원이\n켜져 있는지 확인해 주세요.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {networks.map((ssid, index) => (
                <TouchableOpacity
                  key={ssid}
                  style={[styles.listItem, index < networks.length - 1 && styles.listItemBorder]}
                  onPress={() => onSelect?.(ssid)}
                >
                  <Text style={styles.ssid}>{ssid}</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.links}>
            <TouchableOpacity style={styles.link} onPress={onRescan}>
              <Text style={styles.linkText}>다시 찾기</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={onHome}>
          <Text style={styles.secondaryText}>처음으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0ED',
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
    fontWeight: '400',
    lineHeight: 26,
    color: '#513E39',
  },
  list: {
    backgroundColor: '#FFFCFA',
    borderRadius: 22,
    shadowColor: '#342724',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 18,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
  },
  ssid: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D2220',
    lineHeight: 20,
  },
  chevron: {
    fontSize: 20,
    color: '#705A54',
  },
  note: {
    backgroundColor: '#F6E2DB',
    borderRadius: 16,
    padding: 14,
    paddingVertical: 12,
  },
  noteText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: '#AD332C',
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
  secondaryButton: {
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
    fontWeight: '700',
    color: '#2D2220',
    lineHeight: 20,
  },
});