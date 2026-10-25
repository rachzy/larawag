/*
 * Lifecycle and edge cases in a real browser (Chromium + SwiftShader). Leaks are measured from outside the
 * library: an init script wraps the WebGL create/delete calls, getContext and requestAnimationFrame, so the
 * library needs no debug hook. Tests wait on rendered frames (onTick counts), never on fixed sleeps.
 */
import { PNG } from 'pngjs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StarSystemView, SystemInput } from '@larawag/core';
import { startHarness, type Harness } from './harness';

const TIMEOUT = 60_000;

interface Probe {
  live: Record<string, number>;
  contexts: number;
  lost: number;
  pendingRaf: number;
}

declare global {
  interface Window {
    __lw: {
      createStarSystem: typeof import('@larawag/core').createStarSystem;
      LarawagValidationError: typeof import('@larawag/core').LarawagValidationError;
      stage: HTMLElement;
      bareRenderer: () => void;
    };
    __probe: () => Probe;
    __frames: (view: StarSystemView, n?: number) => Promise<void>;
  }
}

/** Runs in the page before any script: counts live GL objects, GL contexts (and which are lost) and pending rAF callbacks. */
function instrument(): void {
  const kinds = ['Texture', 'Buffer', 'Program', 'Framebuffer', 'Renderbuffer', 'Shader', 'VertexArray'];
  const live = new Set<object>();
  const kindOf = new Map<object, string>();
  for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const kind of kinds) {
      const proto = Ctx.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      const create = proto['create' + kind];
      const del = proto['delete' + kind];
      if (!create || !del || Object.prototype.hasOwnProperty.call(create, '__wrapped')) continue;
      proto['create' + kind] = function (this: unknown, ...a: unknown[]) {
        const o = create.apply(this, a) as object | null;
        if (o) {
          live.add(o);
          kindOf.set(o, kind);
        }
        return o;
      };
      proto['delete' + kind] = function (this: unknown, ...a: unknown[]) {
        const o = a[0] as object | null;
        if (o) live.delete(o);
        return del.apply(this, a);
      };
    }
  }
  const contexts: WebGLRenderingContext[] = [];
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...a: unknown[]) {
    const gl = (getContext as (...x: unknown[]) => unknown).apply(this, a);
    if (gl && /webgl/.test(String(a[0])) && !contexts.includes(gl as WebGLRenderingContext)) contexts.push(gl as WebGLRenderingContext);
    return gl;
  } as typeof getContext;
  const pending = new Set<number>();
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    const id: number = raf((t) => {
      pending.delete(id);
      cb(t);
    });
    pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    caf(id);
  };
  window.__probe = () => {
    const counts: Record<string, number> = {};
    for (const o of live) counts[kindOf.get(o)!] = (counts[kindOf.get(o)!] ?? 0) + 1;
    return {
      live: counts,
      contexts: contexts.length,
      lost: contexts.filter((c) => c.isContextLost()).length,
      pendingRaf: pending.size,
    };
  };
  // Resolves after `n` more rendered frames (onTick runs inside each frame, before its render call).
  window.__frames = (view, n = 3) =>
    new Promise<void>((resolve, reject) => {
      let left = n + 1;
      const timer = setTimeout(() => reject(new Error('no rendered frames')), 15_000); // a stalled loop fails fast
      const off = view.onTick(() => {
        if (--left === 0) {
          off();
          clearTimeout(timer);
          resolve();
        }
      });
    });
}

/** Like `instrument`, but WebGL is unavailable. */
function noWebgl(): void {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
    return id === '2d' ? (null as never) : null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

const SYSTEM: SystemInput = {
  star: { name: 'Test star', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [
    { name: 'b', period: 4.2, radius: 1.5, phase: 0.6 },
    { name: 'c', period: 18.5, radius: 3.6, phase: 2.9 },
  ],
};
const FIVE: SystemInput = {
  star: SYSTEM.star,
  planets: [3, 7, 14, 28, 60].map((period, i) => ({ period, radius: 1 + i * 0.7, phase: i * 1.1 })),
};

let harness: Harness;
let browser: Browser;
let base: string;

beforeAll(async () => {
  harness = await startHarness();
  ({ browser, base } = harness);
});
afterAll(async () => {
  await harness?.close();
});

interface Session {
  context: BrowserContext;
  page: Page;
  errors: string[];
}

/** Opens lifecycle.html in a fresh context; `init` runs before page scripts. */
async function open(opts: { init?: () => void; reducedMotion?: 'reduce' | 'no-preference' } = {}): Promise<Session> {
  const context = await browser.newContext({
    viewport: { width: 980, height: 560 },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion ?? 'no-preference',
  });
  await context.addInitScript(opts.init ?? instrument);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(base + 'lifecycle.html');
  await page.waitForFunction(() => '__lw' in window);
  return { context, page, errors };
}

async function withSession(
  opts: Parameters<typeof open>[0],
  fn: (s: Session) => Promise<void>,
  allowed: RegExp[] = [],
): Promise<void> {
  const s = await open(opts);
  try {
    await fn(s);
    expect(s.errors.filter((e) => !allowed.some((a) => a.test(e)))).toEqual([]);
  } finally {
    await s.context.close();
  }
}

/** Creates the view in the page as `window.v` (typed loosely; the page code is a string-free closure). */
const create = (page: Page, input: SystemInput, options?: object): Promise<void> =>
  page.evaluate(
    ([i, o]) => {
      const w = window as unknown as { v: StarSystemView };
      w.v = window.__lw.createStarSystem(window.__lw.stage, i as never, o as never);
    },
    [input, options ?? {}] as const,
  );

const frames = (page: Page, n = 3): Promise<void> =>
  page.evaluate((k) => window.__frames((window as unknown as { v: StarSystemView }).v, k), n);

/** Pixels with R+G+B above 384 inside the stage. */
async function brightPixels(page: Page): Promise<number> {
  const png = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: 960, height: 540 } }));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! + png.data[i + 1]! + png.data[i + 2]! > 384) n++;
  return n;
}

describe('lifecycle', () => {
  it('create and destroy 20 times leaves nothing behind', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      // Baseline: what a bare three renderer keeps after dispose() + forceContextLoss() (its own internals:
      // placeholder textures, framebuffers). The library may leave exactly that per view and nothing else.
      const before = await page.evaluate(() => window.__probe());
      expect(before).toEqual({ live: {}, contexts: 0, lost: 0, pendingRaf: 0 });
      await page.evaluate(() => window.__lw.bareRenderer());
      const bare = await page.evaluate(() => window.__probe());
      expect(bare.contexts).toBe(1);
      expect(bare.lost).toBe(1);
      expect(Object.keys(bare.live).length).toBeGreaterThan(0);
      await page.evaluate(async (input) => {
        for (let i = 0; i < 20; i++) {
          const v = window.__lw.createStarSystem(window.__lw.stage, input as never);
          await window.__frames(v, 2);
          v.destroy();
        }
      }, SYSTEM);
      // Let any callback that was still in flight at destroy time fire or be cancelled.
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      const after = await page.evaluate(() => ({
        probe: window.__probe(),
        larawagNodes: document.querySelectorAll('.larawag, .larawag-label, .larawag-clock, .larawag-badge, canvas').length,
        styles: document.querySelectorAll('style[data-larawag]').length,
        stageChildren: window.__lw.stage.childElementCount,
      }));
      expect(after.larawagNodes).toBe(0);
      expect(after.styles).toBe(0);
      expect(after.stageChildren).toBe(0);
      expect(after.probe.pendingRaf).toBe(0);
      const expectedLive = Object.fromEntries(Object.entries(bare.live).map(([k, n]) => [k, n * 21]));
      expect(after.probe.live).toEqual(expectedLive);
      expect(after.probe.contexts).toBe(21);
      expect(after.probe.lost).toBe(21);
    });
  });

  it('calls after destroy() and a second destroy() do not throw', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, SYSTEM);
      await frames(page);
      const r = await page.evaluate(() => {
        const v = (window as unknown as { v: StarSystemView }).v;
        v.destroy();
        const thrown: string[] = [];
        const t = (name: string, f: () => unknown): void => {
          try {
            f();
          } catch (e) {
            thrown.push(`${name}: ${String(e)}`);
          }
        };
        t('destroy', () => v.destroy());
        t('play', () => v.play());
        t('pause', () => v.pause());
        t('setRate', () => v.setRate(5));
        t('setTime', () => v.setTime(5));
        t('setScaleMode', () => v.setScaleMode('true'));
        t('setHabitableZoneVisible', () => v.setHabitableZoneVisible(false));
        t('setView', () => v.setView('transit'));
        t('resetView', () => v.resetView());
        t('setSystem', () => v.setSystem({ star: { teff: 5000, radius: 1, mass: 1 }, planets: [] } as never));
        t('setOverlays', () => v.setOverlays({ labels: false }));
        t('onTick', () => v.onTick(() => {})());
        t('getters', () => [v.system, v.playing, v.rate, v.time, v.scaleMode]);
        return { thrown, nodes: document.querySelectorAll('.larawag').length, time: v.time, playing: v.playing };
      });
      expect(r.thrown).toEqual([]);
      expect(r.nodes).toBe(0);
      expect(r.time).not.toBe(5);
    });
  });
});

describe('edge cases', () => {
  it('zero planets renders star and habitable zone without labels', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, { star: SYSTEM.star, planets: [] });
      await frames(page, 4);
      const r = await page.evaluate(() => {
        const v = (window as unknown as { v: StarSystemView }).v;
        return { planets: v.system.planets.length, labels: document.querySelectorAll('.larawag-label').length, time: v.time };
      });
      expect(r.planets).toBe(0);
      expect(r.labels).toBe(0);
      expect(r.time).toBeGreaterThan(0);
      expect(await brightPixels(page)).toBeGreaterThan(300);
    });
  });

  it('five planets: labels in the transit view do not overlap', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, FIVE, { autoplay: false, overlays: { labels: true } });
      await page.evaluate(() => (window as unknown as { v: StarSystemView }).v.setView('transit'));
      const shownAt: number[] = [];
      for (const t of [0, 3, 11.5, 40]) {
        await page.evaluate((d) => (window as unknown as { v: StarSystemView }).v.setTime(d), t);
        await frames(page, 2);
        const rects = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.larawag-label')]
            .filter((el) => el.style.display !== 'none')
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { l: r.left, t: r.top, r: r.right, b: r.bottom };
            }),
        );
        shownAt.push(rects.length);
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i]!;
            const b = rects[j]!;
            const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
            expect(overlap, `time ${t}: labels ${i} and ${j} overlap`).toBe(false);
          }
      }
      // Guard against a vacuous pass: the labels were really on screen.
      expect(Math.max(...shownAt)).toBeGreaterThanOrEqual(4);
    });
  });

  it('container resized to 0x0 and back keeps running and renders again', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, SYSTEM);
      await frames(page);
      const lit = await brightPixels(page);
      expect(lit).toBeGreaterThan(1000);
      await page.evaluate(() => {
        window.__lw.stage.style.width = '0px';
        window.__lw.stage.style.height = '0px';
      });
      const t0 = await page.evaluate(() => (window as unknown as { v: StarSystemView }).v.time);
      await frames(page, 5);
      const t1 = await page.evaluate(() => (window as unknown as { v: StarSystemView }).v.time);
      expect(t1).toBeGreaterThan(t0);
      await page.evaluate(() => {
        window.__lw.stage.style.width = '960px';
        window.__lw.stage.style.height = '540px';
      });
      await page.waitForFunction(() => {
        const c = document.querySelector('canvas')!;
        return c.width === 960 && c.height === 540;
      });
      await frames(page, 3);
      expect(await brightPixels(page)).toBeGreaterThan(lit / 2);
    });
  });

  it('setSystem with invalid input throws a validation error and the old system keeps running', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, SYSTEM);
      await frames(page);
      const r = await page.evaluate(async () => {
        const v = (window as unknown as { v: StarSystemView }).v;
        const before = v.system;
        let err: { name: string; isInstance: boolean; issues: { path: string }[] } | null = null;
        try {
          v.setSystem({ star: { teff: -5, radius: 0, mass: 1 }, planets: [{ period: 3, radius: 1 }] } as never);
        } catch (e) {
          const x = e as { name: string; issues: { path: string }[] };
          err = { name: x.name, isInstance: e instanceof window.__lw.LarawagValidationError, issues: x.issues };
        }
        const t0 = v.time;
        await window.__frames(v, 3);
        return { err, same: v.system === before, advanced: v.time > t0, labels: document.querySelectorAll('.larawag-label').length };
      });
      expect(r.err?.name).toBe('LarawagValidationError');
      expect(r.err?.isInstance).toBe(true);
      expect(r.err!.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['star.teff', 'star.radius']));
      expect(r.same).toBe(true);
      expect(r.advanced).toBe(true);
      expect(r.labels).toBe(2);
    });
  });

  it('a throwing onTick callback does not kill the render loop', { timeout: TIMEOUT }, async () => {
    const s = await open();
    try {
      await create(s.page, SYSTEM);
      const r = await s.page.evaluate(async () => {
        const v = (window as unknown as { v: StarSystemView }).v;
        v.onTick(() => {
          throw new Error('tick boom');
        });
        const t0 = v.time;
        await window.__frames(v, 5);
        return { advanced: v.time > t0 };
      });
      expect(r.advanced).toBe(true);
      expect(await brightPixels(s.page)).toBeGreaterThan(1000);
      // The error still reaches the host's error handlers, once per frame.
      expect(s.errors.length).toBeGreaterThanOrEqual(5);
      expect(s.errors.every((m) => m.includes('tick boom'))).toBe(true);
    } finally {
      await s.context.close();
    }
  });
});

describe('environment', () => {
  it('WebGL unavailable: fallback shown, no throw, methods are no-ops', { timeout: TIMEOUT }, async () => {
    await withSession({ init: noWebgl }, async ({ page }) => {
      const r = await page.evaluate(async () => {
        const v = window.__lw.createStarSystem(window.__lw.stage, {
          star: { teff: 5100, radius: 0.8, mass: 0.85 },
          planets: [{ period: 4.2, radius: 1.5 }],
        });
        const thrown: string[] = [];
        for (const f of [
          () => v.play(),
          () => v.pause(),
          () => v.setRate(5),
          () => v.setTime(5),
          () => v.setScaleMode('true'),
          () => v.setHabitableZoneVisible(false),
          () => v.setView('transit'),
          () => v.resetView(),
          () => v.setOverlays({ labels: false }),
          () => v.onTick(() => {})(),
        ])
          try {
            f();
          } catch (e) {
            thrown.push(String(e));
          }
        await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
        const fb = document.querySelector('.larawag-fallback');
        const out = {
          thrown,
          text: fb?.textContent,
          visible: !!fb && getComputedStyle(fb).display !== 'none',
          canvases: document.querySelectorAll('canvas').length,
          time: v.time,
          playing: v.playing,
          scaleMode: v.scaleMode,
        };
        v.destroy();
        v.destroy();
        return { ...out, after: document.querySelectorAll('.larawag').length };
      });
      expect(r.thrown).toEqual([]);
      expect(r.text).toBe('WebGL is not available in this browser, so the 3D view cannot start.');
      expect(r.visible).toBe(true);
      expect(r.canvases).toBe(0);
      expect(r.time).toBe(0);
      expect(r.playing).toBe(false);
      expect(r.scaleMode).toBe('compressed');
      expect(r.after).toBe(0);
    }, [/Error creating WebGL context/]); // three logs this itself before the library falls back
  });

  it('prefers-reduced-motion starts paused; autoplay: true overrides it', { timeout: TIMEOUT }, async () => {
    await withSession({ reducedMotion: 'reduce' }, async ({ page }) => {
      await create(page, SYSTEM);
      await frames(page, 4);
      expect(await page.evaluate(() => {
        const v = (window as unknown as { v: StarSystemView }).v;
        return { playing: v.playing, time: v.time };
      })).toEqual({ playing: false, time: 0 });
      await page.evaluate(() => (window as unknown as { v: StarSystemView }).v.destroy());
      await create(page, SYSTEM, { autoplay: true });
      await frames(page, 4);
      const r = await page.evaluate(() => {
        const v = (window as unknown as { v: StarSystemView }).v;
        return { playing: v.playing, time: v.time };
      });
      expect(r.playing).toBe(true);
      expect(r.time).toBeGreaterThan(0);
    });
  });

  it('without reduced motion the view plays by default', { timeout: TIMEOUT }, async () => {
    await withSession({}, async ({ page }) => {
      await create(page, SYSTEM);
      await frames(page, 4);
      expect(await page.evaluate(() => (window as unknown as { v: StarSystemView }).v.playing)).toBe(true);
    });
  });
});
