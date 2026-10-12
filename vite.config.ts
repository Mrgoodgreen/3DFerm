import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_debugger: true },
      mangle: { properties: false },
      format: { comments: false },
    },
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
