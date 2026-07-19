import { defineConfig } from 'vite';

export default defineConfig({
    // Proje kökünde index.html + ham JS/CSS dosyaları var, framework yok — vanilla mod.
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: true,
        cssMinify: true,
        chunkSizeWarningLimit: 2000,
    },
});
