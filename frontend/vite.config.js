import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // URL de la API documental leída desde .env para configurar el proxy
  const iaApiUrl = env.VITE_API_IA_DOCUMENTAL_URL || 'http://127.0.0.1:8001'

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        // Todas las peticiones a /consultar (y demás endpoints de la API documental)
        // se redirigen al servidor FastAPI, evitando errores de CORS en desarrollo.
        '/consultar': {
          target: iaApiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
