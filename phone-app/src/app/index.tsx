import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { TabKey } from '@/components/TabBar'
import { AlarmTab } from '@/features/alarm/AlarmTab'
import { ResvTab } from '@/features/resv/ResvTab'

// 첫 화면: 알람 탭. 아래 탭 막대로 알람·예약 탭을 오간다(자세 탭은 만들면 연결한다).
// 탭을 바꿔도 각 탭의 상태가 남도록 두 탭을 모두 그려 두고 고른 탭만 보인다
export default function Index() {
  const [tab, setTab] = useState<TabKey>('alarm')
  const pick = (key: TabKey) => {
    if (key !== 'pose') setTab(key)
  }
  return (
    <View style={styles.fill}>
      <View style={[styles.fill, tab !== 'alarm' && styles.hidden]}>
        <AlarmTab onTab={pick} />
      </View>
      <View style={[styles.fill, tab !== 'resv' && styles.hidden]}>
        <ResvTab onTab={pick} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
})
