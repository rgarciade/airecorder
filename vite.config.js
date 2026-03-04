import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Rutas relativas para que funcione con file:// en Electron
  server: {
    port: 5173,
    strictPort: true, // Si el puerto está ocupado, lanza error
  },
})
