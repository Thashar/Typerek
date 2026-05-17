import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

const buildId = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version',
      buildStart() {
        writeFileSync('public/version.json', JSON.stringify({ id: buildId }))
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
