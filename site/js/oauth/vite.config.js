import { defineConfig } from 'vite'
import { resolve } from 'path'
export default defineConfig({
  build: {
    lib: {
      entry: {
        'oauth-manager': resolve(__dirname, 'src/oauth-manager.js'),
        'oauth-callback': resolve(__dirname, 'src/oauth-callback.js'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`
    },
    outDir: '../widgets',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
      }
    }
  }
})
