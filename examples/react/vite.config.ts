import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const src = (path: string): string => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

// Alias to the sources so the dev server needs no prior library build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@larawag\/core\/physics$/, replacement: src('core/src/physics.ts') },
      { find: /^@larawag\/core$/, replacement: src('core/src/index.ts') },
      { find: /^@larawag\/react$/, replacement: src('react/src/index.ts') },
    ],
  },
});
