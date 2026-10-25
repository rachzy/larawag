import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const core = (file: string): string => fileURLToPath(new URL(`../../packages/core/src/${file}`, import.meta.url));

// Alias to the source so the dev server needs no prior library build.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@larawag\/core\/physics$/, replacement: core('physics.ts') },
      { find: /^@larawag\/core$/, replacement: core('index.ts') },
    ],
  },
});
