import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const legacyAssetNames = {
  'app.js': ['index-sqrXEzad.js', 'index-L71X6Ni2.js'],
  'app.css': ['index-D52gpzNu.css', 'index-I1hnMvon.css'],
}

function preserveLegacyAssets(): Plugin {
  return {
    name: 'preserve-legacy-pages-assets',
    apply: 'build',
    closeBundle() {
      const assetsDirectory = fileURLToPath(new URL('./dist/assets/', import.meta.url))
      for (const [currentName, aliases] of Object.entries(legacyAssetNames)) {
        for (const alias of aliases) copyFileSync(join(assetsDirectory, currentName), join(assetsDirectory, alias))
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'github' ? '/funding-decision-hub/' : '/',
  plugins: [react(), preserveLegacyAssets()],
  build: {
    target: ['es2019', 'safari13'],
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/app[extname]',
      },
    },
  },
}))
