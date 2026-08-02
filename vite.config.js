import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // A GitHub project page is served from /<repo>/, not from the domain root.
  // The deploy workflow passes the repository name in, so this stays correct
  // whether the site ends up at a project path, a user page, or a custom
  // domain — nothing here has to be edited when that changes.
  base: process.env.VITE_BASE || '/',

  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    // Split the heavy renderer stack out of the entry chunk so the intro can
    // paint before three.js has finished parsing.
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'post', test: /node_modules[\\/](postprocessing|@react-three[\\/]postprocessing)[\\/]/ },
            { name: 'r3f', test: /node_modules[\\/]@react-three[\\/]/ },
          ],
        },
      },
    },
  },
})
