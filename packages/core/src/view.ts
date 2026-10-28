import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { deriveSystem, type DerivedSystem } from './physics/derive.js';
import type { SystemInput } from './physics/types.js';
import { cameraFit, cameraPreset } from './render/camera.js';
import { createLabels, type Labels } from './render/labels.js';
import { createOverlays, type OverlayConfig } from './render/overlays.js';
import { createRenderer } from './render/renderer-setup.js';
import { planetRadius, type ScaleMode } from './render/scales.js';
import type { PlanetStyle } from './render/planets.js';
import { buildSystemScene, type SystemScene } from './render/scene-assembly.js';
import { createStarfield, type StarfieldPiece } from './render/starfield.js';
import { injectStyles } from './render/styles.js';

/** Options for `createStarSystem`. Every field is optional. */
export interface ViewOptions {
  /** Default 'compressed'. */
  scaleMode?: 'compressed' | 'true';
  /** Default true. */
  showHabitableZone?: boolean;
  /** Simulated days per second, default 10**0.2 (≈1.58). */
  rate?: number;
  /** Default true, but false under prefers-reduced-motion. */
  autoplay?: boolean;
  /** At true scale, minimum planet size in pixels. Default 0 (off). */
  minPlanetPixels?: number;
  /**
   * Default 'inferred': planets without a texture or colour get a look guessed from class and
   * temperature. 'prototype' gives them the v1 prototype's textures instead.
   */
  planetStyle?: 'inferred' | 'prototype';
  overlays?: {
    /** Default true. */
    labels?: boolean;
    /** Default "Simulated time: 12.3 days". */
    clock?: boolean | { format?: (days: number) => string };
    /** Default "Hypothetical · artist's impression". */
    badge?: boolean | { text?: string };
  };
  /** Shown if WebGL fails. */
  fallbackText?: string;
}

/** A running star-system view. Every method is a harmless no-op after `destroy()`. */
export interface StarSystemView {
  readonly system: DerivedSystem;
  play(): void;
  pause(): void;
  readonly playing: boolean;
  setRate(daysPerSecond: number): void;
  readonly rate: number;
  setTime(days: number): void;
  readonly time: number;
  setScaleMode(mode: 'compressed' | 'true'): void;
  readonly scaleMode: 'compressed' | 'true';
  setHabitableZoneVisible(visible: boolean): void;
  setView(preset: 'home' | 'transit'): void;
  /** Same as `setView('home')`. */
  resetView(): void;
  /** Validates first; on error throws and keeps the old system. */
  setSystem(input: SystemInput): void;
  setOverlays(overlays: ViewOptions['overlays']): void;
  /** Calls `cb(days)` every frame. Returns an unsubscribe function. */
  onTick(cb: (days: number) => void): () => void;
  /** Idempotent. */
  destroy(): void;
}

const DEFAULT_FALLBACK = 'WebGL is not available in this browser, so the 3D view cannot start.';
const DEFAULT_RATE = 10 ** 0.2;
const SPIN_RATE = 0.8;

/** Planet orbital angle in radians after `days` of simulated time. */
export function planetAngle(phase: number, periodDays: number, days: number): number {
  return phase + (2 * Math.PI * days) / periodDays;
}

const validRate = (r: unknown): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0;
const validMode = (m: unknown): m is ScaleMode => m === 'compressed' || m === 'true';

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type OverlayState = { labels: boolean } & OverlayConfig;

function mergeOverlays(cur: OverlayState, next: ViewOptions['overlays']): OverlayState {
  const out = { ...cur };
  if (next?.labels !== undefined) out.labels = next.labels;
  if (next?.clock !== undefined) out.clock = next.clock;
  if (next?.badge !== undefined) out.badge = next.badge;
  return out;
}

/**
 * Renders `input` into a new `div.larawag` inside `container`. Throws
 * `LarawagValidationError` for invalid input (nothing is created). If WebGL is
 * unavailable, shows `fallbackText` and returns a view whose methods do nothing.
 */
export function createStarSystem(
  container: HTMLElement,
  input: SystemInput,
  options: ViewOptions = {},
): StarSystemView {
  let system = deriveSystem(input);
  let mode: ScaleMode = validMode(options.scaleMode) ? options.scaleMode : 'compressed';
  let rate = validRate(options.rate) ? options.rate : DEFAULT_RATE;
  let showHz = options.showHabitableZone ?? true;
  const minPlanetPixels =
    typeof options.minPlanetPixels === 'number' && options.minPlanetPixels > 0
      ? options.minPlanetPixels
      : 0;
  const planetStyle: PlanetStyle = options.planetStyle === 'prototype' ? 'prototype' : 'inferred';
  let overlayState = mergeOverlays({ labels: true, clock: true, badge: true }, options.overlays);
  let simDays = 0;
  let destroyed = false;

  const releaseStyle = injectStyles();
  const wrapper = document.createElement('div');
  wrapper.className = 'larawag';
  container.appendChild(wrapper);
  const renderer = createRenderer(wrapper);

  if (!renderer) {
    const fallback = document.createElement('div');
    fallback.className = 'larawag-fallback';
    fallback.textContent = options.fallbackText ?? DEFAULT_FALLBACK;
    wrapper.appendChild(fallback);
    const noop = (): void => {};
    return {
      get system() {
        return system;
      },
      get playing() {
        return false;
      },
      get rate() {
        return rate;
      },
      get time() {
        return simDays;
      },
      get scaleMode() {
        return mode;
      },
      play: noop,
      pause: noop,
      setRate: noop,
      setTime: noop,
      setScaleMode: noop,
      setHabitableZoneVisible: noop,
      setView: noop,
      resetView: noop,
      setOverlays: noop,
      setSystem(next) {
        if (destroyed) return;
        system = deriveSystem(next);
      },
      onTick: () => noop,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        wrapper.remove();
        releaseStyle();
      },
    };
  }

  // If anything below throws, undo what was built (newest first) so nothing leaks.
  const undo: (() => void)[] = [
    () => {
      wrapper.remove();
      releaseStyle();
    },
    () => {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  ];
  try {
    let playing = options.autoplay ?? !prefersReducedMotion();
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.05, 6000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    undo.push(() => controls.dispose());

    let fit = 0;
    let starfield: StarfieldPiece | null = null;
    let pieces: SystemScene = buildSystemScene(system, mode, showHz, planetStyle);
    undo.push(() => pieces.dispose());
    scene.add(pieces.root);
    let labels: Labels = createLabels(wrapper, system.planets, { enabled: overlayState.labels });
    undo.push(() => labels.dispose());
    const overlays = createOverlays(wrapper, overlayState);
    undo.push(() => overlays.dispose());
    undo.push(() => starfield?.dispose());
    const labelPos: Vector3[] = [];
    const ticks = new Set<(days: number) => void>();
    let width = 0;
    let height = 0;

    /** Applies the camera fit for the current pieces; returns true when it changed. */
    const applyFit = (): boolean => {
      const next = cameraFit(mode, pieces.outerOrbit);
      if (next === fit) return false;
      fit = next;
      camera.far = 6000 * fit;
      camera.updateProjectionMatrix();
      controls.minDistance = 3 * fit;
      controls.maxDistance = 900 * fit;
      if (starfield) {
        scene.remove(starfield.points);
        starfield.dispose();
      }
      starfield = createStarfield(2500 * fit);
      scene.add(starfield.points);
      return true;
    };

    const setView = (kind: 'home' | 'transit'): void => {
      const p = cameraPreset(mode, kind, fit);
      camera.position.set(p[0], p[1], p[2]);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    let last = performance.now();
    let rafId = 0;
    let failed = false;

    /** Renders one frame; on error stops the loop for good and rethrows once, asynchronously. */
    const renderNow = (updateControls: boolean): void => {
      try {
        if (updateControls) controls.update();
        renderer.render(scene, camera);
      } catch (e) {
        // A render error would repeat every frame.
        failed = true;
        cancelAnimationFrame(rafId);
        setTimeout(() => {
          throw e;
        });
      }
    };

    const resize = (): void => {
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      if (!w || !h) return;
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // setSize clears the canvas; redraw now unless the loop has not started or has stopped.
      if (rafId && !failed && !destroyed) renderNow(false);
    };

    const syncLabelPositions = (): void => {
      labelPos.length = pieces.bodies.length;
      for (let i = 0; i < labelPos.length; i++) labelPos[i] ??= new Vector3();
    };

    applyFit();
    setView('home');
    syncLabelPositions();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(resize);
      observer.observe(wrapper);
    } else {
      window.addEventListener('resize', resize);
    }
    undo.push(() => {
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resize);
    });
    resize();

    const tanHalfFov = (): number => Math.tan(((camera.fov * Math.PI) / 180) / 2);

    const frame = (now: number): void => {
      if (failed || destroyed) return;
      // Schedule first so an error below can never stop the loop.
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (playing) simDays += dt * rate;
      const grow = mode === 'true' && minPlanetPixels > 0 && height > 0;
      pieces.bodies.forEach((b, i) => {
        const th = planetAngle(b.planet.phase, b.planet.periodDays, simDays);
        b.mesh.position.set(b.orbitRadius * Math.cos(th), 0, b.orbitRadius * Math.sin(th));
        b.mesh.rotation.y += playing ? dt * SPIN_RATE : 0;
        if (grow) {
          const dist = camera.position.distanceTo(b.mesh.position);
          const ppu = height / (2 * tanHalfFov() * dist);
          const r = planetRadius('true', b.planet.radiusEarth, b.planet.rpOverRs, minPlanetPixels, ppu);
          b.mesh.scale.setScalar(r);
        }
        const v = labelPos[i]!.copy(b.mesh.position);
        v.y += b.mesh.scale.x;
      });
      labels.update(labelPos, camera, width, height);
      overlays.setTime(simDays);
      for (const cb of ticks) {
        try {
          cb(simDays);
        } catch (e) {
          // Keep the loop and the other callbacks running; still surface the error to the host.
          setTimeout(() => {
            throw e;
          });
        }
      }
      if (destroyed) return; // a callback may have destroyed the view
      renderNow(true);
    };
    rafId = requestAnimationFrame(frame);

    return {
      get system() {
        return system;
      },
      get playing() {
        return playing;
      },
      get rate() {
        return rate;
      },
      get time() {
        return simDays;
      },
      get scaleMode() {
        return mode;
      },
      play() {
        if (!destroyed) playing = true;
      },
      pause() {
        if (!destroyed) playing = false;
      },
      setRate(r) {
        if (!destroyed && validRate(r)) rate = r;
      },
      setTime(days) {
        if (!destroyed && Number.isFinite(days)) simDays = days;
      },
      setScaleMode(m) {
        if (destroyed || !validMode(m) || m === mode) return;
        mode = m;
        pieces.applyScale(mode);
        applyFit();
        setView('home');
      },
      setHabitableZoneVisible(v) {
        if (destroyed) return;
        showHz = v;
        pieces.setHabitableZoneVisible(v);
      },
      setView(kind) {
        if (!destroyed && (kind === 'home' || kind === 'transit')) setView(kind);
      },
      resetView() {
        if (!destroyed) setView('home');
      },
      setSystem(next) {
        if (destroyed) return;
        const derived = deriveSystem(next);
        const nextPieces = buildSystemScene(derived, mode, showHz, planetStyle);
        pieces.dispose();
        labels.dispose();
        system = derived;
        pieces = nextPieces;
        scene.add(pieces.root);
        labels = createLabels(wrapper, system.planets, { enabled: overlayState.labels });
        syncLabelPositions();
        if (applyFit()) setView('home');
      },
      setOverlays(next) {
        if (destroyed || !next) return;
        overlayState = mergeOverlays(overlayState, next);
        labels.setEnabled(overlayState.labels);
        overlays.setConfig(overlayState);
      },
      onTick(cb) {
        if (destroyed) return () => {};
        ticks.add(cb);
        return () => {
          ticks.delete(cb);
        };
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(rafId);
        if (observer) observer.disconnect();
        else window.removeEventListener('resize', resize);
        ticks.clear();
        controls.dispose();
        pieces.dispose();
        starfield?.dispose();
        starfield = null;
        scene.clear();
        labels.dispose();
        overlays.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        wrapper.remove();
        releaseStyle();
      },
    };
  } catch (e) {
    for (const step of undo.reverse()) {
      try {
        step();
      } catch {
        // Keep undoing; the original error is the one to report.
      }
    }
    throw e;
  }
}
