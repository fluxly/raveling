import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'components.ts'),
            formats: ['es'],
            fileName: () => 'bundle.js',
        },
        outDir: resolve(__dirname),
        emptyOutDir: false,
        copyPublicDir: false,
    },
});
