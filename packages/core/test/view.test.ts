// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import type { Mesh, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createStarSystem, LarawagValidationError } from '../src/index.js';
import { planetAngle } from '../src/view.js';
import type { StarSystemView } from '../src/index.js';
import { cameraPreset } from '../src/render/camera.js';
import { createRenderer } from '../src/render/renderer-setup.js';
import { planetTexture } from '../src/render/textures.js';
import type { SystemInput } from '../src/physics/types.js';
import { fixture } from './fixture.js';

// jsdom has no canvas 2D context: textures become plain three Textures.
vi.mock('../src/render/textures.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/render/textures.js')>();
  return { ...real, planetTexture: vi.fn(() => new Texture()), glowTexture: () => new Texture() };
});

// The real createRenderer by default; tests that need a "working" GL swap in a fake.
vi.mock('../src/render/renderer-setup.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/render/renderer-setup.js')>();
  return { ...real, createRenderer: vi.fn(real.createRenderer) };
});

const DEFAULT_FALLBACK = 'WebGL is not available in this browser, so the 3D view cannot start.';

interface FakeRenderer {
  domElement: HTMLCanvasElement;
  setSize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  forceContextLoss: ReturnType<typeof vi.fn>;
  info: { memory: { geometries: number; textures: number } };
}

let fake: FakeRenderer | null = null;
let frames: Map<number, FrameRequestCallback>;
let nextId = 1;
const cancelled: number[] = [];

function useFakeRenderer(): void {
  vi.mocked(createRenderer).mockImplementation((parent: HTMLElement) => {
    const domElement = document.createElement('canvas');
    parent.insertBefore(domElement, parent.firstChild);
    fake = {
      domElement,
      setSize: vi.fn(),
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      info: { memory: { geometries: 0, textures: 0 } },
    };
    return fake as unknown as WebGLRenderer;
  });
}

/** Runs every pending animation frame callback at time `now` (ms). */
function step(now: number): void {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, cb] of pending) cb(now);
}

function stubMatchMedia(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: reduced && q.includes('reduce'), media: q })),
  );
}

function lastCamera(): PerspectiveCamera {
  const call = fake!.render.mock.lastCall as [Scene, PerspectiveCamera];
  return call[1];
}

function expectNear(got: number[], want: number[]): void {
  got.forEach((g, i) => expect(g).toBeCloseTo(want[i]!, 6));
}

let container: HTMLElement;
const views: StarSystemView[] = [];
function make(input: SystemInput = fixture, opts?: Parameters<typeof createStarSystem>[2]) {
  const v = createStarSystem(container, input, opts);
  views.push(v);
  return v;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  frames = new Map();
  cancelled.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  for (const v of views.splice(0)) v.destroy();
  fake = null;
  vi.mocked(createRenderer).mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('planetAngle', () => {
  it('equals the phase at t = 0 and advances one turn per period', () => {
    expect(planetAngle(0.6, 4.2, 0)).toBe(0.6);
    expect(planetAngle(0.6, 4.2, 4.2)).toBeCloseTo(0.6 + 2 * Math.PI);
    expect(planetAngle(0, 18.5, 9.25)).toBeCloseTo(Math.PI);
  });
});

describe('createStarSystem without WebGL', () => {
  beforeEach(async () => {
    const real = await vi.importActual<typeof import('../src/render/renderer-setup.js')>(
      '../src/render/renderer-setup.js',
    );
    vi.mocked(createRenderer).mockImplementation(real.createRenderer);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    // three reports the failed context; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns an inert view with fallback text and a derived system', () => {
    const v = make();
    const fb = container.querySelector('.larawag > .larawag-fallback');
    expect(fb?.textContent).toBe(DEFAULT_FALLBACK);
    expect(container.querySelector('canvas')).toBeNull();
    expect(v.system.planets.map((p) => p.name)).toEqual(['b', 'c']);
    expect(v.playing).toBe(false);
    expect(v.rate).toBeCloseTo(10 ** 0.2);
    expect(() => {
      v.play();
      v.pause();
      v.setRate(5);
      v.setTime(10);
      v.setScaleMode('true');
      v.setHabitableZoneVisible(false);
      v.setView('transit');
      v.resetView();
      v.setOverlays({ labels: false });
      v.onTick(() => {})();
    }).not.toThrow();
    expect(v.playing).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('uses fallbackText', () => {
    make(fixture, { fallbackText: 'Kein WebGL' });
    expect(container.querySelector('.larawag-fallback')?.textContent).toBe('Kein WebGL');
  });

  it('setSystem(invalid) throws and keeps the system', () => {
    const v = make();
    const before = v.system;
    expect(() => v.setSystem({ star: { teff: -1, radius: 1, mass: 1 }, planets: [] })).toThrow(
      LarawagValidationError,
    );
    expect(v.system).toBe(before);
  });

  it('destroy() twice removes the wrapper and the style', () => {
    const v = make();
    expect(document.querySelector('style[data-larawag]')).not.toBeNull();
    v.destroy();
    expect(() => v.destroy()).not.toThrow();
    expect(container.querySelector('.larawag')).toBeNull();
    expect(document.querySelector('style[data-larawag]')).toBeNull();
  });
});

describe('createStarSystem input validation', () => {
  it('throws LarawagValidationError and creates no DOM', () => {
    useFakeRenderer();
    const bad = { star: { teff: 5100, radius: 0.8, mass: 0.85 }, planets: [{ radius: -2 }] };
    expect(() => make(bad as SystemInput)).toThrow(LarawagValidationError);
    expect(container.childElementCount).toBe(0);
    expect(document.querySelector('style[data-larawag]')).toBeNull();
    expect(createRenderer).not.toHaveBeenCalled();
  });
});

describe('createStarSystem with a renderer', () => {
  beforeEach(() => useFakeRenderer());

  it('undoes everything and rethrows when building the scene fails', () => {
    const boom = new Error('larawag: no 2D canvas context');
    vi.mocked(planetTexture).mockImplementationOnce(() => {
      throw boom;
    });
    expect(() => make()).toThrow(boom);
    expect(container.childElementCount).toBe(0);
    expect(document.querySelector('style[data-larawag]')).toBeNull();
    expect(fake!.dispose).toHaveBeenCalledOnce();
    expect(fake!.forceContextLoss).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });

  it('planetTexture throws a clear error without a 2D canvas context', async () => {
    const real = await vi.importActual<typeof import('../src/render/textures.js')>(
      '../src/render/textures.js',
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => real.planetTexture('rocky', 1)).toThrow(/2D canvas context/);
    expect(() => real.glowTexture()).toThrow(/2D canvas context/);
  });

  it('builds the wrapper, canvas, labels and overlays', () => {
    make();
    const w = container.querySelector('.larawag')!;
    expect(w.querySelector('canvas')).toBe(fake!.domElement);
    expect(w.querySelectorAll('.larawag-label').length).toBe(2);
    expect(w.querySelector('.larawag-clock')).not.toBeNull();
    expect(w.querySelector('.larawag-badge')).not.toBeNull();
    expect(w.querySelector('.larawag-fallback')).toBeNull();
  });

  it('defaults: rate 10^0.2, autoplay, compressed, home camera', () => {
    const v = make();
    expect(v.rate).toBeCloseTo(1.585, 3);
    expect(v.playing).toBe(true);
    expect(v.scaleMode).toBe('compressed');
    step(16);
    const cam = lastCamera();
    expect(cam.fov).toBe(45);
    expect(cam.near).toBe(0.05);
    expect(cam.far).toBe(6000);
    expectNear(cam.position.toArray(), cameraPreset('compressed', 'home'));
  });

  it('starts paused under prefers-reduced-motion; explicit autoplay wins', () => {
    stubMatchMedia(true);
    expect(make().playing).toBe(false);
    expect(make(fixture, { autoplay: true }).playing).toBe(true);
    stubMatchMedia(false);
    expect(make().playing).toBe(true);
    expect(make(fixture, { autoplay: false }).playing).toBe(false);
  });

  it('advances time only while playing, with dt capped at 0.1 s', () => {
    const v = make(fixture, { rate: 2 });
    step(500); // dt = min(0.1, 0.5) = 0.1
    expect(v.time).toBeCloseTo(0.2);
    step(550); // dt = 0.05
    expect(v.time).toBeCloseTo(0.3);
    v.pause();
    step(600);
    expect(v.time).toBeCloseTo(0.3);
    v.play();
    v.setRate(10);
    step(700);
    expect(v.time).toBeCloseTo(1.3);
  });

  it('ignores invalid rates and times', () => {
    const v = make(fixture, { rate: -3 });
    expect(v.rate).toBeCloseTo(10 ** 0.2);
    v.setRate(4);
    v.setRate(0);
    v.setRate(Number.NaN);
    expect(v.rate).toBe(4);
    v.setTime(12);
    v.setTime(Number.POSITIVE_INFINITY);
    expect(v.time).toBe(12);
  });

  it('places planets at phase + 2π t / period and updates the clock', () => {
    const v = make(fixture, { autoplay: false });
    v.setTime(2.1); // half of b's period
    step(16);
    const scene = (fake!.render.mock.lastCall as [Scene])[0];
    const sphere: Scene['children'] = [];
    scene.traverse((o) => {
      if ((o as { geometry?: { type: string } }).geometry?.type === 'SphereGeometry') sphere.push(o);
    });
    // the star (r = 0) and two planets
    const planets = sphere.filter((m) => m.position.length() > 0);
    expect(planets.length).toBe(2);
    const b = planets.find((m) => Math.abs(m.position.z) < 1e-9 && m.position.x < 0);
    expect(b).toBeDefined();
    expect(container.querySelector('.larawag-clock')?.textContent).toBe(
      'Simulated time: 2.1 days',
    );
  });

  it('onTick reports the time each frame until unsubscribed', () => {
    const v = make(fixture, { rate: 1 });
    const cb = vi.fn();
    const off = v.onTick(cb);
    step(100);
    step(200);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(v.time);
    off();
    step(300);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('a throwing onTick callback does not stop the loop, other callbacks, or rendering; the error resurfaces asynchronously', () => {
    const v = make(fixture, { rate: 1 });
    const deferred: (() => void)[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((fn: () => void) => void deferred.push(fn)) as unknown as typeof setTimeout,
    );
    const boom = new Error('boom');
    const other = vi.fn();
    v.onTick(() => {
      throw boom;
    });
    v.onTick(other);
    step(100);
    expect(other).toHaveBeenCalledTimes(1);
    expect(fake!.render).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    step(200);
    expect(other).toHaveBeenCalledTimes(2);
    expect(v.time).toBeGreaterThan(0);
    expect(deferred).toHaveLength(2);
    expect(deferred[0]).toThrow(boom);
  });

  it('a render error stops the loop and surfaces once, asynchronously; destroy() still works', () => {
    const v = make();
    const deferred: (() => void)[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((fn: () => void) => void deferred.push(fn)) as unknown as typeof setTimeout,
    );
    const boom = new Error('render boom');
    fake!.render.mockImplementation(() => {
      throw boom;
    });
    expect(() => step(100)).not.toThrow();
    expect(frames.size).toBe(0);
    step(200);
    step(300);
    expect(fake!.render).toHaveBeenCalledTimes(1);
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toThrow(boom);
    const r = fake!;
    v.destroy();
    v.destroy();
    expect(r.dispose).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
  });

  it('destroying the view from an onTick callback stops the loop without rendering', () => {
    const v = make();
    v.onTick(() => v.destroy());
    step(100);
    expect(fake!.render).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('setScaleMode changes the mode and resets the camera to home', () => {
    const v = make();
    step(16);
    const cam = lastCamera();
    v.setView('transit');
    expectNear(cam.position.toArray(), cameraPreset('compressed', 'transit'));
    v.setScaleMode('true');
    expect(v.scaleMode).toBe('true');
    expectNear(cam.position.toArray(), cameraPreset('true', 'home'));
    v.setView('transit');
    v.resetView();
    expectNear(cam.position.toArray(), cameraPreset('true', 'home'));
  });

  it('setSystem keeps time, rate, playing and mode', () => {
    const v = make(fixture, { rate: 3 });
    v.setScaleMode('true');
    v.setTime(7);
    v.pause();
    v.setSystem({ ...fixture, planets: [{ radius: 2, period: 9, name: 'x' }] });
    expect(v.system.planets.map((p) => p.name)).toEqual(['x']);
    expect(v.time).toBe(7);
    expect(v.rate).toBe(3);
    expect(v.playing).toBe(false);
    expect(v.scaleMode).toBe('true');
    expect(container.querySelectorAll('.larawag-label').length).toBe(1);
  });

  it('setSystem(invalid) throws and changes nothing', () => {
    const v = make();
    const before = v.system;
    expect(() => v.setSystem({ star: fixture.star, planets: [{ radius: 1 }] })).toThrow(
      LarawagValidationError,
    );
    expect(v.system).toBe(before);
    expect(container.querySelectorAll('.larawag-label').length).toBe(2);
  });

  it('frames a much wider system with a scaled camera', () => {
    const v = make({ star: fixture.star, planets: [{ radius: 11, a: 30 }] });
    step(16);
    const cam = lastCamera();
    expect(cam.far).toBeGreaterThan(6000);
    expect(cam.position.length()).toBeGreaterThan(
      Math.hypot(...cameraPreset('compressed', 'home')),
    );
    // Back to the example: fit returns to 1 and the camera is reset.
    v.setSystem(fixture);
    expect(cam.far).toBe(6000);
    expectNear(cam.position.toArray(), cameraPreset('compressed', 'home'));
  });

  it('rebuilds the habitable-zone ring on scale change and keeps its visibility', () => {
    const v = make(fixture, { showHabitableZone: false });
    step(16);
    const scene = (fake!.render.mock.lastCall as [Scene])[0];
    const ring = () => {
      let found: Mesh | undefined;
      scene.traverse((o) => {
        if ((o as Mesh).geometry?.type === 'RingGeometry') found = o as Mesh;
      });
      return found!;
    };
    const old = ring();
    expect(old.visible).toBe(false);
    const disposed = vi.spyOn(old.geometry, 'dispose');
    v.setScaleMode('true');
    expect(disposed).toHaveBeenCalledOnce();
    expect(ring()).not.toBe(old);
    expect(ring().visible).toBe(false);
    v.setHabitableZoneVisible(true);
    expect(ring().visible).toBe(true);
  });

  it('raises planets to minPlanetPixels at true scale', () => {
    const v = make(fixture, { scaleMode: 'true', minPlanetPixels: 6 });
    const w = container.querySelector<HTMLElement>('.larawag')!;
    Object.defineProperty(w, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(w, 'clientHeight', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));
    step(16);
    const scene = (fake!.render.mock.lastCall as [Scene])[0];
    const b = v.system.planets[0]!;
    let mesh: Mesh | undefined;
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry?.type === 'SphereGeometry' && m.position.length() > 0 && !mesh) mesh = m;
    });
    expect(mesh!.scale.x).toBeGreaterThan(b.rpOverRs);
  });

  it('renders a lone star', () => {
    const v = make({ star: fixture.star, planets: [] });
    expect(() => step(16)).not.toThrow();
    expect(container.querySelectorAll('.larawag-label').length).toBe(0);
    expect(v.system.planets).toEqual([]);
  });

  it('runs a star given only by its spectral type, and swaps it with setSystem', () => {
    const v = make({ star: { spectralType: 'M4V' }, planets: fixture.planets });
    expect(v.system.star.teff).toBe(3210);
    expect(() => step(16)).not.toThrow();
    v.setSystem({ star: { spectralType: 'A0V', name: 'Vega-like' }, planets: fixture.planets });
    expect(v.system.star).toMatchObject({ name: 'Vega-like', teff: 9700, spectralType: 'A0V' });
    expect(() => step(16)).not.toThrow();
  });

  it('setOverlays merges into the current config', () => {
    const v = make();
    v.setOverlays({ badge: { text: 'Hypothetisch' } });
    expect(container.querySelector('.larawag-badge')?.textContent).toBe('Hypothetisch');
    expect(container.querySelector('.larawag-clock')).not.toBeNull();
    v.setOverlays({ clock: false });
    expect(container.querySelector('.larawag-clock')).toBeNull();
    expect(container.querySelector('.larawag-badge')?.textContent).toBe('Hypothetisch');
  });

  it('skips resizing a 0x0 container and resizes a real one', () => {
    make();
    step(16);
    expect(fake!.setSize).not.toHaveBeenCalled();
    expect(Number.isFinite(lastCamera().aspect)).toBe(true);
    const w = container.querySelector<HTMLElement>('.larawag')!;
    Object.defineProperty(w, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(w, 'clientHeight', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));
    expect(fake!.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(lastCamera().aspect).toBe(2);
  });

  it('re-renders right after a resize so the cleared canvas never shows', () => {
    make();
    step(16);
    const w = container.querySelector<HTMLElement>('.larawag')!;
    Object.defineProperty(w, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(w, 'clientHeight', { configurable: true, value: 400 });
    const before = fake!.render.mock.calls.length;
    window.dispatchEvent(new Event('resize'));
    expect(fake!.render).toHaveBeenCalledTimes(before + 1);
    const setSizeOrder = fake!.setSize.mock.invocationCallOrder.at(-1)!;
    expect(fake!.render.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(setSizeOrder);
  });

  it('destroy() releases everything and later calls are no-ops', () => {
    const v = make();
    step(16);
    const r = fake!;
    v.destroy();
    v.destroy();
    expect(r.dispose).toHaveBeenCalledOnce();
    expect(r.forceContextLoss).toHaveBeenCalledOnce();
    expect(cancelled.length).toBe(1);
    expect(frames.size).toBe(0);
    expect(container.childElementCount).toBe(0);
    expect(document.querySelector('style[data-larawag]')).toBeNull();
    const t = v.time;
    expect(() => {
      v.play();
      v.setTime(99);
      v.setScaleMode('true');
      v.setSystem({ star: fixture.star, planets: [] });
      v.setOverlays({ labels: false });
      v.setView('transit');
      v.onTick(() => {})();
    }).not.toThrow();
    expect(v.time).toBe(t);
    expect(v.scaleMode).toBe('compressed');
    window.dispatchEvent(new Event('resize'));
    expect(r.setSize).not.toHaveBeenCalled();
  });

  it('keeps the shared style until the last view is destroyed', () => {
    const a = make();
    const b = make();
    a.destroy();
    expect(document.querySelector('style[data-larawag]')).not.toBeNull();
    b.destroy();
    expect(document.querySelector('style[data-larawag]')).toBeNull();
  });
});
