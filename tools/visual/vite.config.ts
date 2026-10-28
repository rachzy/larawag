import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const r128 = dirname(require.resolve('three-r128/package.json'));
const R128_FILES: Record<string, string> = {
  '/r128/three.min.js': join(r128, 'build/three.min.js'),
  '/r128/OrbitControls.js': join(r128, 'examples/js/controls/OrbitControls.js'),
};

/** Serves the two three r128 UMD scripts that reference.html loads. */
function serveR128(): Plugin {
  return {
    name: 'serve-r128',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? R128_FILES[req.url] : undefined;
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
  };
}

const pkg = (file: string): string => fileURLToPath(new URL(`../../packages/${file}`, import.meta.url));

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  plugins: [serveR128()],
  resolve: {
    alias: [
      { find: /^@larawag\/core$/, replacement: pkg('core/src/index.ts') },
      { find: /^@larawag\/react$/, replacement: pkg('react/src/index.ts') },
    ],
  },
  server: { strictPort: false },
  logLevel: 'warn',
});
