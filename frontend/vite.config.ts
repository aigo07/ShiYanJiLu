import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Docker 部署下由 nginx 反代 /api，不需要 dev server proxy 配置。
})
