import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Alias Node.js modules to an empty file so the browser doesn't crash importing them
      fs: resolve(__dirname, 'src/empty-module.js'),
      path: resolve(__dirname, 'src/empty-module.js'),
      crypto: resolve(__dirname, 'src/empty-module.js'),
    }
  },
  optimizeDeps: {
    exclude: ['sql.js']
  },
  // Ensure we do NOT externalize them, so the alias works and bundles the empty file
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
})
