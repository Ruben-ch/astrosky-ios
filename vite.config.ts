import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // satellite.js v7 embarque un module WASM multi-thread dont le Worker utilise
  // un `await` de haut niveau : workers en ES modules, cible ES2022 (iOS ≥ 15).
  worker: { format: 'es' },
  // Le seul chunk > 500 ko est celui de l'onglet « Système » (Three.js), chargé à la
  // demande par React.lazy : il ne pèse pas sur le démarrage.
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
})
