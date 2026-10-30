import { defineConfig } from 'vitest/config';

// Browser screenshots under SwiftShader are slow; this config is used by `pnpm compare`, `pnpm lifecycle`, `pnpm react` and `pnpm angular`.
export default defineConfig({
  test: {
    include: ['compare.spec.ts', 'lifecycle.spec.ts', 'react.spec.ts', 'angular.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
