/*
 * Screenshot parity: the r128 prototype (reference.html) against @larawag/core on three r186 (library.html),
 * both rendered by SwiftShader at 960x540, time 0, paused, in home, transit and true-scale views.
 *
 * Tolerance. Noise floor (same page rendered twice, 2026-10-25): 0 differing pixels for both pages in all
 * three views, so rendering is deterministic. Before the r128 shading fix the library differed in 1191 (home,
 * 0.23%) and 397 (transit, 0.077%) pixels, up to 10-13/255 per channel on the planets' lit sides; after it,
 * 0 in every view. The check is therefore strict: pixelmatch threshold 0 (any colour change counts),
 * anti-aliased pixels included, at most 0.05% of the canvas (259 px) may differ, which leaves room for a few
 * edge pixels only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import type { Browser } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './harness';

const W = 960;
const H = 540;
const THRESHOLD = 0;
const MAX_RATIO = 0.0005;
const OUT = fileURLToPath(new URL('./out/', import.meta.url));

type ViewName = 'home' | 'transit' | 'true';
type PageName = 'reference' | 'library';

let harness: Harness;
let browser: Browser;
let base: string;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  harness = await startHarness();
  ({ browser, base } = harness);
});

afterAll(async () => {
  await harness?.close();
});

/** Loads one harness page, switches to the view, waits for rendered frames and returns the canvas PNG. */
async function shoot(name: PageName, view: ViewName): Promise<PNG> {
  const context = await browser.newContext({
    viewport: { width: 980, height: 560 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + name + '.html');
  if (name === 'reference') {
    await page.waitForSelector('#stage canvas');
    if (view !== 'home') await page.evaluate((id) => document.getElementById(id)!.click(), view === 'true' ? 'scale' : 'transit');
  } else {
    await page.waitForFunction(() => '__view' in window);
    await page.evaluate((v) => {
      const lv = (window as unknown as { __view: import('@larawag/core').StarSystemView }).__view;
      if (v === 'transit') lv.setView('transit');
      if (v === 'true') lv.setScaleMode('true');
    }, view);
  }
  // Two animation frames guarantee at least one full render after the view change.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const box = await page.locator('#stage canvas').boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: W, height: H });
  const png = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }));
  await context.close();
  expect(errors).toEqual([]);
  return png;
}

/** Mismatch ratio between two canvases; optionally writes the diff image. */
function compare(a: PNG, b: PNG, diffFile?: string): number {
  const diff = new PNG({ width: W, height: H });
  const n = pixelmatch(a.data, b.data, diff.data, W, H, { threshold: THRESHOLD, includeAA: true });
  if (diffFile) writeFileSync(OUT + diffFile, PNG.sync.write(diff));
  return n / (W * H);
}

const VIEWS: ViewName[] = ['home', 'transit', 'true'];

/** Pixels with R+G+B above 384; the real references have 4624 (home), 2603 (transit) and 310 (true). */
function brightPixels(png: PNG): number {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! + png.data[i + 1]! + png.data[i + 2]! > 384) n++;
  return n;
}

// Non-blank guard: about a third of the measured bright pixels, so a black or empty canvas cannot pass.
const MIN_BRIGHT: Record<ViewName, number> = { home: 1500, transit: 800, true: 100 };
const references = new Map<ViewName, PNG>();

describe('noise floor', () => {
  it.each(VIEWS)('%s: same page rendered twice', async (view) => {
    const r = compare(await shoot('reference', view), await shoot('reference', view));
    const l = compare(await shoot('library', view), await shoot('library', view));
    console.log(`noise ${view}: reference ${r} library ${l}`);
    expect(r).toBe(0);
    expect(l).toBe(0);
  });
});

describe('prototype parity', () => {
  it.each(VIEWS)('%s view', async (view) => {
    const ref = await shoot('reference', view);
    const lib = await shoot('library', view);
    writeFileSync(`${OUT}${view}-reference.png`, PNG.sync.write(ref));
    writeFileSync(`${OUT}${view}-library.png`, PNG.sync.write(lib));
    references.set(view, ref);
    expect(brightPixels(ref)).toBeGreaterThanOrEqual(MIN_BRIGHT[view]);
    expect(brightPixels(lib)).toBeGreaterThanOrEqual(MIN_BRIGHT[view]);
    const ratio = compare(ref, lib, `${view}-diff.png`);
    console.log(`parity ${view}: ${ratio}`);
    expect(ratio).toBeLessThanOrEqual(MAX_RATIO);
  });

  it('home and transit screenshots differ (the view switch took effect)', () => {
    const home = references.get('home');
    const transit = references.get('transit');
    expect(home && transit).toBeTruthy();
    expect(compare(home!, transit!)).toBeGreaterThan(0.01);
  });
});
