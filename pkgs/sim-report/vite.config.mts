import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/element.tsx',
      name: 'SimReportElementBundle',
      formats: ['iife'],
      fileName: () => 'sim-report.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'sim-report.[ext]',
      },
    },
    emptyOutDir: true,
  },
});
