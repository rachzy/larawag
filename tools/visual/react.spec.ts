/*
 * The React wrapper in a real browser: mounting, prop updates and unmounting leave nothing behind,
 * measured with the same page instrumentation as lifecycle.spec.ts.
 */
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StarSystemView, SystemInput } from '@larawag/core';
import { startHarness, type Harness } from './harness';
import { instrument, type Probe } from './probe';

const TIMEOUT = 60_000;

const SYSTEM: SystemInput = {
  star: { name: 'Test star', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [
    { name: 'b', period: 4.2, radius: 1.5, phase: 0.6 },
    { name: 'c', period: 18.5, radius: 3.6, phase: 2.9 },
  ],
};
const OTHER: SystemInput = {
  star: SYSTEM.star,
  planets: [3, 7, 14].map((period, i) => ({ period, radius: 1 + i, phase: i })),
};

let harness: Harness;
let browser: Browser;

beforeAll(async () => {
  harness = await startHarness();
  browser = harness.browser;
});
afterAll(async () => {
  await harness?.close();
});

async function withPage(fn: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 980, height: 560 }, reducedMotion: 'no-preference' });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`);
  });
  try {
    await page.goto(harness.base + 'react.html');
    await page.waitForFunction(() => '__rx' in window);
    await fn(page);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
}

const frames = (page: Page, n = 3): Promise<void> =>
  page.evaluate((k) => window.__frames(window.__rx.handle()!.view as StarSystemView, k), n);

const settle = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

async function leftovers(page: Page): Promise<{ probe: Probe; nodes: number; styles: number; stageChildren: number }> {
  return page.evaluate(() => ({
    probe: window.__probe(),
    nodes: document.querySelectorAll('.larawag, .larawag-label, .larawag-clock, .larawag-badge, canvas').length,
    styles: document.querySelectorAll('style[data-larawag]').length,
    stageChildren: window.__rx.stage.childElementCount,
  }));
}

const times = (live: Record<string, number>, n: number): Record<string, number> =>
  Object.fromEntries(Object.entries(live).map(([k, v]) => [k, v * n]));

describe('React wrapper', () => {
  it('StrictMode mount, prop updates and unmount leave nothing behind', { timeout: TIMEOUT }, async () => {
    await withPage(async (page) => {
      await page.evaluate(() => window.__rx.bareRenderer());
      const bare = await page.evaluate(() => window.__probe());

      await page.evaluate((s) => window.__rx.mount({ system: s }, true), SYSTEM);
      await frames(page);
      const mounted = await page.evaluate(() => ({
        canvases: document.querySelectorAll('canvas').length,
        probe: window.__probe(),
      }));
      // StrictMode mounts, unmounts and mounts again: one view is live, one was already freed.
      expect(mounted.canvases).toBe(1);
      expect(mounted.probe.contexts - mounted.probe.lost).toBe(1);
      const contexts = mounted.probe.contexts;

      await page.evaluate((s) => window.__rx.update({ system: s, scaleMode: 'true', showHabitableZone: false, rate: 4 }), OTHER);
      await frames(page);
      const updated = await page.evaluate(() => {
        const v = window.__rx.handle()!.view!;
        return { planets: v.system.planets.length, scaleMode: v.scaleMode, rate: v.rate, contexts: window.__probe().contexts };
      });
      expect(updated).toEqual({ planets: 3, scaleMode: 'true', rate: 4, contexts });

      await page.evaluate(() => window.__rx.unmount());
      await settle(page);
      const after = await leftovers(page);
      expect(after.nodes).toBe(0);
      expect(after.styles).toBe(0);
      expect(after.stageChildren).toBe(0);
      expect(after.probe.pendingRaf).toBe(0);
      expect(after.probe.lost).toBe(after.probe.contexts);
      // At most three's per-renderer internals: the StrictMode throwaway view never drew, so it may keep fewer.
      const allowed = times(bare.live, after.probe.contexts);
      for (const [kind, n] of Object.entries(after.probe.live)) expect(n).toBeLessThanOrEqual(allowed[kind] ?? 0);
    });
  });

  it('mounting and unmounting 10 times leaves nothing behind', { timeout: TIMEOUT }, async () => {
    await withPage(async (page) => {
      await page.evaluate(() => window.__rx.bareRenderer());
      const bare = await page.evaluate(() => window.__probe());
      for (let i = 0; i < 10; i++) {
        await page.evaluate((s) => window.__rx.mount({ system: s }), SYSTEM);
        await frames(page, 2);
        await page.evaluate(() => window.__rx.unmount());
      }
      await settle(page);
      const after = await leftovers(page);
      expect(after.nodes).toBe(0);
      expect(after.stageChildren).toBe(0);
      expect(after.probe.pendingRaf).toBe(0);
      expect(after.probe.contexts).toBe(11);
      expect(after.probe.lost).toBe(11);
      expect(after.probe.live).toEqual(times(bare.live, 11));
    });
  });

  it('rebuilding for a creation-only prop keeps the simulated time and frees the old view', { timeout: TIMEOUT }, async () => {
    await withPage(async (page) => {
      await page.evaluate((s) => window.__rx.mount({ system: s }), SYSTEM);
      await frames(page);
      await page.evaluate(() => window.__rx.handle()!.setTime(50));
      await page.evaluate((s) => window.__rx.update({ system: s, minPlanetPixels: 2 }), SYSTEM);
      await frames(page);
      const r = await page.evaluate(() => ({
        time: window.__rx.handle()!.view!.time,
        canvases: document.querySelectorAll('canvas').length,
        probe: window.__probe(),
      }));
      expect(r.time).toBeGreaterThanOrEqual(50);
      expect(r.canvases).toBe(1);
      expect(r.probe.contexts - r.probe.lost).toBe(1);
      await page.evaluate(() => window.__rx.unmount());
    });
  });
});
