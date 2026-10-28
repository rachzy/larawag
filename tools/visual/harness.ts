/** Shared browser-test setup: the vite server for the harness pages and the SwiftShader Chromium launch recipe. */
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

export interface Harness {
  server: ViteDevServer;
  browser: Browser;
  /** Base URL of the dev server, with a trailing slash. */
  base: string;
  close(): Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const server = await createServer({ configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) });
  await server.listen(0);
  const base = server.resolvedUrls!.local[0]!;
  const browser = await chromium.launch({
    // Playwright's own Chromium (`pnpm exec playwright install chromium`) unless LARAWAG_CHROMIUM names another.
    executablePath: process.env.LARAWAG_CHROMIUM || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  return {
    server,
    browser,
    base,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
