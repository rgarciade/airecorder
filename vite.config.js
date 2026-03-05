import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    })
  ],
  build: {
    sourcemap: true, // Sentry necesita los sourcemaps para desofuscar errores
  },
  base: './', // Rutas relativas para que funcione con file:// en Electron
  server: {
    port: 5173,
    strictPort: true, // Si el puerto está ocupado, lanza error
  },
})
