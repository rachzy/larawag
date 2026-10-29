import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { deriveSystem, type DerivedSystem } from './physics/derive.js';
import type { SystemInput } from './physics/types.js';
import { cameraFit, cameraPreset } from './render/camera.js';
import { easeInOut, followDistance, pickPlanet } from './render/follow.js';
import { createLabels, type Labels } from './render/labels.js';
import { createOverlays, createUnlockButton, type OverlayConfig, type UnlockButton } from './render/overlays.js';
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
  /** At true scale, minimum planet diameter in pixels. Default 8 (0 with `planetStyle: 'prototype'`); 0 is off. */
  minPlanetPixels?: number;
  /**
   * Default 'inferred': planets without a texture or colour get a look guessed from class and
   * temperature. 'prototype' gives them the v1 prototype's textures instead.
   */
  planetStyle?: 'inferred' | 'prototype';
  /**
   * Default false. When true, clicking a planet or its label locks the camera on that planet and
   * follows its orbit; Esc or the "Unlock camera" button releases it.
   */
  followOnClick?: boolean;
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
  /** Index of the planet the camera follows, or null. */
  readonly following: number | null;
  /** Locks the camera on planet `index` (ignored if there is no such planet). */
  follow(index: number): void;
  /** Releases the camera where it is. */
  unfollow(): void;
  /** Calls `cb(index)` when the followed planet changes (null when released). Returns an unsubscribe function. */
  onFollowChange(cb: (index: number | null) => void): () => void;
  /** Calls `cb(days)` every frame. Returns an unsubscribe function. */
  onTick(cb: (days: number) => void): () => void;
  /** Idempotent. */
  destroy(): void;
}

const DEFAULT_FALLBACK = 'WebGL is not available in this browser, so the 3D view cannot start.';
const DEFAULT_RATE = 10 ** 0.2;
const DEFAULT_MIN_PLANET_PIXELS = 8;
const SPIN_RATE = 0.8;
const FLIGHT_MS = 800;
const NEAR = 0.05;
/** A press that moves less than this many pixels before release is a click, not a drag. */
const CLICK_SLOP = 5;

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
  const planetStyle: PlanetStyle = options.planetStyle === 'prototype' ? 'prototype' : 'inferred';
  const followOnClick = options.followOnClick === true;
  const minPlanetPixels =
    typeof options.minPlanetPixels === 'number' && Number.isFinite(options.minPlanetPixels)
      ? Math.max(0, options.minPlanetPixels)
      : planetStyle === 'prototype'
        ? 0
        : DEFAULT_MIN_PLANET_PIXELS;
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
      get following() {
        return null;
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
      follow: noop,
      unfollow: noop,
      onFollowChange: () => noop,
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
    const camera = new PerspectiveCamera(45, 1, NEAR, 6000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    undo.push(() => controls.dispose());

    let fit = 0;
    let starfield: StarfieldPiece | null = null;
    let pieces: SystemScene = buildSystemScene(system, mode, showHz, planetStyle);
    undo.push(() => pieces.dispose());
    scene.add(pieces.root);
    let followed: number | null = null;
    let flight: { start: number; fromCam: Vector3; fromTarget: Vector3 } | null = null;
    let unlockButton: UnlockButton | null = null;
    const followPos = new Vector3();
    const followDir = new Vector3();
    const followChanges = new Set<(index: number | null) => void>();
    const labelClick = followOnClick ? (i: number): void => follow(i) : undefined;
    const makeLabels = (): Labels =>
      createLabels(wrapper, system.planets, { enabled: overlayState.labels, onClick: labelClick });
    let labels: Labels = makeLabels();
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

    const emitFollow = (): void => {
      for (const cb of followChanges) {
        try {
          cb(followed);
        } catch (e) {
          setTimeout(() => {
            throw e;
          });
        }
      }
    };

    /** Planet radius in scene units at its true drawn size, rings included. */
    const followExtent = (i: number): number => {
      const p = pieces.bodies[i]!.planet;
      return planetRadius(mode, p.radiusEarth, p.rpOverRs, 0) * Math.max(1, p.rings?.outer ?? 1);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) unfollow();
    };

    /** Starts (or restarts) the fly-in to planet `i` and keeps following it. */
    const follow = (i: number): void => {
      if (!Number.isInteger(i) || i < 0 || i >= pieces.bodies.length) return;
      const changed = followed !== i;
      if (followed === null) window.addEventListener('keydown', onKey);
      followed = i;
      flight = { start: -1, fromCam: camera.position.clone(), fromTarget: controls.target.clone() };
      const extent = followExtent(i);
      controls.enabled = false;
      controls.enablePan = false;
      controls.minDistance = extent * 1.5;
      camera.near = Math.min(NEAR, extent * 0.5);
      camera.updateProjectionMatrix();
      labels.setFollowed(i);
      unlockButton ??= createUnlockButton(wrapper, unfollow);
      unlockButton.setVisible(true);
      if (changed) emitFollow();
    };

    const unfollow = (): void => {
      if (followed === null) return;
      followed = null;
      flight = null;
      window.removeEventListener('keydown', onKey);
      controls.enabled = true;
      controls.enablePan = true;
      controls.minDistance = 3 * fit;
      camera.near = NEAR;
      camera.updateProjectionMatrix();
      labels.setFollowed(null);
      unlockButton?.setVisible(false);
      emitFollow();
    };
    undo.push(() => {
      window.removeEventListener('keydown', onKey);
      unlockButton?.dispose();
    });

    /** Moves the camera along with the followed planet; call after the planets moved. */
    const updateFollow = (now: number): void => {
      if (followed === null) return;
      const p = pieces.bodies[followed]!.mesh.position;
      if (flight) {
        if (flight.start < 0) flight.start = now;
        const t = prefersReducedMotion() ? 1 : (now - flight.start) / FLIGHT_MS;
        const e = easeInOut(t);
        followDir.subVectors(flight.fromCam, p).normalize();
        if (followDir.lengthSq() === 0) followDir.set(0, 0, 1);
        followDir.multiplyScalar(followDistance(followExtent(followed), camera.fov)).add(p);
        controls.target.lerpVectors(flight.fromTarget, p, e);
        camera.position.lerpVectors(flight.fromCam, followDir, e);
        if (t >= 1) {
          flight = null;
          controls.enabled = true;
        }
      } else {
        followDir.subVectors(p, followPos);
        camera.position.add(followDir);
        controls.target.add(followDir);
      }
      followPos.copy(p);
    };

    const setView = (kind: 'home' | 'transit'): void => {
      const p = cameraPreset(mode, kind, fit);
      camera.position.set(p[0], p[1], p[2]);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    const tanHalfFov = (): number => Math.tan(((camera.fov * Math.PI) / 180) / 2);

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

    let press: { id: number; x: number; y: number } | null = null;
    const pickPoint = new Vector3();
    const onPointerDown = (e: PointerEvent): void => {
      press = e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    };
    const onPointerUp = (e: PointerEvent): void => {
      const p = press;
      press = null;
      if (!p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP) return;
      if (!width || !height) return;
      const rect = renderer.domElement.getBoundingClientRect();
      camera.updateMatrixWorld();
      const points = pieces.bodies.map((b) => {
        pickPoint.copy(b.mesh.position).project(camera);
        if (pickPoint.z >= 1) return null;
        const dist = camera.position.distanceTo(b.mesh.position);
        const ppu = height / (2 * tanHalfFov() * dist);
        return {
          x: (pickPoint.x * 0.5 + 0.5) * width,
          y: (-pickPoint.y * 0.5 + 0.5) * height,
          r: b.mesh.scale.x * ppu,
        };
      });
      const hit = pickPlanet(points, e.clientX - rect.left, e.clientY - rect.top);
      if (hit !== null) follow(hit);
    };
    if (followOnClick) {
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
    }
    const removePointer = (): void => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
    };
    undo.push(removePointer);

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


    const frame = (now: number): void => {
      if (failed || destroyed) return;
      // Schedule first so an error below can never stop the loop.
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (playing) simDays += dt * rate;
      for (const b of pieces.bodies) {
        const th = planetAngle(b.planet.phase, b.planet.periodDays, simDays);
        b.mesh.position.set(b.orbitRadius * Math.cos(th), 0, b.orbitRadius * Math.sin(th));
        b.mesh.rotation.y += playing ? dt * SPIN_RATE : 0;
      }
      // A followed planet can move many camera distances per frame, so aim the camera before projecting.
      const following = followed !== null;
      if (following) {
        updateFollow(now);
        controls.update();
        camera.updateMatrixWorld();
      }
      const grow = mode === 'true' && minPlanetPixels > 0 && height > 0;
      pieces.bodies.forEach((b, i) => {
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
      renderNow(!following);
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
      get following() {
        return followed;
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
        if (followed !== null) follow(followed);
        else setView('home');
      },
      setHabitableZoneVisible(v) {
        if (destroyed) return;
        showHz = v;
        pieces.setHabitableZoneVisible(v);
      },
      setView(kind) {
        if (destroyed || (kind !== 'home' && kind !== 'transit')) return;
        unfollow();
        setView(kind);
      },
      resetView() {
        if (destroyed) return;
        unfollow();
        setView('home');
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
        labels = makeLabels();
        syncLabelPositions();
        const refit = applyFit();
        if (followed !== null && followed < pieces.bodies.length) {
          labels.setFollowed(followed);
          follow(followed);
        } else {
          unfollow();
          if (refit) setView('home');
        }
      },
      setOverlays(next) {
        if (destroyed || !next) return;
        overlayState = mergeOverlays(overlayState, next);
        labels.setEnabled(overlayState.labels);
        overlays.setConfig(overlayState);
      },
      follow(i) {
        if (!destroyed) follow(i);
      },
      unfollow() {
        if (!destroyed) unfollow();
      },
      onFollowChange(cb) {
        if (destroyed) return () => {};
        followChanges.add(cb);
        return () => {
          followChanges.delete(cb);
        };
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
        followChanges.clear();
        followed = null;
        window.removeEventListener('keydown', onKey);
        removePointer();
        unlockButton?.dispose();
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
