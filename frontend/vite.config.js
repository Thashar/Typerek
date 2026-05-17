import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildId = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version',
      buildStart() {
        const publicDir = join(__dirname, 'public')
        mkdirSync(publicDir, { recursive: true })
        writeFileSync(join(publicDir, 'version.json'), JSON.stringify({ id: buildId }))
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
