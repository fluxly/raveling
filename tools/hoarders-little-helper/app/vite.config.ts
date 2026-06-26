import { defineConfig } from 'vite';
import { resolve } from 'path';

// Tauri's internal dev server uses the same host; disable HMR overlay noise.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    resolve: {
        alias: {
            // Treat the built Raveling bundle as an installed package.
            '@raveling/components': resolve(__dirname, '../../../dist/bundle.js'),
        },
    },
    server: {
        port:        3100,
        strictPort:  true,
        host:        host ?? false,
        hmr:         host ? { protocol: 'ws', host, port: 3100 } : undefined,
    },
    build: {
        outDir:  'dist',
        target:  'esnext',
        minify:  false,
    },
    clearScreen: false,
});
