import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the same build working on Vercel and GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
