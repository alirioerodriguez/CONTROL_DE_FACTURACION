/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Instalable en el celular. Guarda la app (no los datos): sin conexión se
    // abre igual, pero avisa y no deja cargar nada.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // se registra en main.tsx
      includeAssets: ['honorapp-favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'honorapp',
        short_name: 'honorapp',
        description: 'Control de cobros para profesionales con pacientes: sesiones, pagos, saldos y reportes.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F5F4F0',
        theme_color: '#557F69',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/plantilla-cobros\.xlsx$/],
      },
    }),
  ],
  build: {
    // exceljs y jspdf pesan ~1 MB, pero se cargan solo al importar o exportar.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
