import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tmdbProxyPlugin } from './src/shared/tmdbProxyPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tmdbProxyPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/shared/setupTests.js'],
    globals: false,
  },
})
