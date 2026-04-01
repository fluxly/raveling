import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    dts({ include: ['core'], rollupTypes: true }),
    viteStaticCopy({
      targets: [
        { src: 'index.html', dest: '.' },
        { src: 'styles/styles.css', dest: 'styles' },
       // { src: 'core/web-components/**/tests/*', dest: 'tests' },
      ],
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    lib: {
      // Full framework bundle
      entry: {
        'bundle': resolve(__dirname, 'core/index.ts'),
        // Individual component categories
      },
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
