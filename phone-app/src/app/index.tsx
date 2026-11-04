import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { TabKey } from '@/components/TabBar'
import { AlarmTab } from '@/features/alarm/AlarmTab'
import { PoseTab } from '@/features/pose/PoseTab'
import { ResvTab } from '@/features/resv/ResvTab'

// 탭을 바꿔도 각 탭의 상태가 남도록 세 탭을 모두 그려 두고 고른 탭만 보인다
export default function Index() {
  const [tab, setTab] = useState<TabKey>('pose')
  const pick = (key: TabKey) => setTab(key)
  return (
    <View style={styles.fill}>
      <View style={[styles.fill, tab !== 'pose' && styles.hidden]}>
        <PoseTab onTab={pick} />
      </View>
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
