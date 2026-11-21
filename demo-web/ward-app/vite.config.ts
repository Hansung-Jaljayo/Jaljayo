import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 보드 앱 WebView에서 앱 안 파일로 열 수 있게 상대 경로로 빌드한다
export default defineConfig({
  base: './',
  plugins: [react()],
})
