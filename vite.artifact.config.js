import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A build that collapses to one HTML file.
 *
 * The normal build splits the renderer stack so the intro can paint early.
 * This one does the opposite on purpose: some hosts (artifact pages, a single
 * file dropped on a machine) can only serve one document, and a strict CSP
 * there blocks every external request — so there must be nothing to request.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-single',
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
})
