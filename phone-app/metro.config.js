// 홈 사진 칸 침대 페이지(html)와 사진 묶음(txt)을 앱 안에 넣으려고 파일 종류를 더한다
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('txt', 'html')

module.exports = config
