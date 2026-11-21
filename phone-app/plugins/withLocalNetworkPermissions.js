// 같은 와이파이의 보드를 찾고 붙는 데 필요한 안드로이드 권한을 빌드할 때 AndroidManifest에 넣는다.
// android/ 폴더는 저장소에 올리지 않고 `npx expo prebuild`로 새로 만들기 때문에, 권한을 여기 적어 둬야 새 빌드에도 들어간다.
// - NEARBY_WIFI_DEVICES: 안드로이드 13 이상 근처 기기 권한. 위치에는 쓰지 않으므로 neverForLocation 표시를 붙인다.
// - ACCESS_LOCAL_NETWORK: 안드로이드 16 이상 로컬 네트워크 권한(같은 공유기 안 기기 접속).
const { withAndroidManifest } = require('expo/config-plugins')

const PERMISSIONS = [
  { name: 'android.permission.NEARBY_WIFI_DEVICES', extra: { 'android:usesPermissionFlags': 'neverForLocation' } },
  { name: 'android.permission.ACCESS_LOCAL_NETWORK', extra: {} },
]

module.exports = function withLocalNetworkPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    manifest['uses-permission'] = manifest['uses-permission'] || []
    for (const p of PERMISSIONS) {
      const found = manifest['uses-permission'].find((u) => u.$['android:name'] === p.name)
      if (found) Object.assign(found.$, p.extra)
      else manifest['uses-permission'].push({ $: { 'android:name': p.name, ...p.extra } })
    }
    return cfg
  })
}
