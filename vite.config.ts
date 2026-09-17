import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'github' ? '/funding-decision-hub/' : '/',
  plugins: [react()],
}))
