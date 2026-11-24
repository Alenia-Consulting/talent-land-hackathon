import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, Vite reenvía /api al backend. Cambia API_URL en .env si no está en :8787.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const destino = env.API_URL || 'http://127.0.0.1:8787'
  const proxy = { '/api': { target: destino, changeOrigin: true } }
  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { proxy },
  }
})
