import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { createStarSystem, type StarSystemView, type SystemInput, type ViewOptions } from '@larawag/core';

/** Inputs shared by `useStarSystem` and `<StarSystem>`. Every field is optional. */
export interface StarSystemProps {
  /** Calls `setScaleMode` when it changes. */
  scaleMode?: ViewOptions['scaleMode'];
  /** Calls `setHabitableZoneVisible` when it changes. */
  showHabitableZone?: boolean;
  /** Simulated days per second. Calls `setRate` when it changes. */
  rate?: number;
  /** Calls `setOverlays` when it changes (compared field by field). */
  overlays?: ViewOptions['overlays'];
  /** Left unset, core's autoplay rule applies. Set, it plays or pauses the view. */
  playing?: boolean;
  /** Creation only: a change rebuilds the view. */
  autoplay?: boolean;
  /** Creation only: a change rebuilds the view. */
  minPlanetPixels?: number;
  /** Creation only: a change rebuilds the view. */
  fallbackText?: string;
  /** Called every frame with the simulated time in days. */
  onTick?: (days: number) => void;
  /** Called when the system is invalid. The previous system, if any, stays on screen. */
  onError?: (error: unknown) => void;
}

/** Imperative access to the view. Methods do nothing while no view exists. */
export interface StarSystemHandle {
  /** The live view, or null before mount, after unmount, or while the first system is invalid. */
  readonly view: StarSystemView | null;
  play(): void;
  pause(): void;
  setTime(days: number): void;
  setView(preset: 'home' | 'transit'): void;
  resetView(): void;
}

type Overlays = ViewOptions['overlays'];

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
};

const sameOverlays = (a: Overlays, b: Overlays): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof NonNullable<Overlays>>;
  return [...keys].every((k) => shallowEqual(a[k], b[k]));
};

/**
 * Mounts a star-system view in `containerRef`'s element and keeps it in sync with
 * `system` (compared by value) and `props`. Destroys the view on unmount.
 */
export function useStarSystem(
  containerRef: RefObject<HTMLElement | null>,
  system: SystemInput,
  props: StarSystemProps = {},
): StarSystemHandle {
  const { scaleMode, showHabitableZone, rate, overlays, playing, autoplay, minPlanetPixels, fallbackText } = props;
  const latest = useRef({ system, props });
  useLayoutEffect(() => {
    latest.current = { system, props };
  });

  const viewRef = useRef<StarSystemView | null>(null);
  // What the live view currently shows, so a setter runs only on a real change.
  const applied = useRef<{ scaleMode?: string; showHabitableZone?: boolean; rate?: number; overlays?: Overlays }>({});
  const attempted = useRef<string | null>(null);
  const savedTime = useRef(0);
  const systemKey = JSON.stringify(system);

  const create = (container: HTMLElement): void => {
    const { system: input, props: p } = latest.current;
    attempted.current = JSON.stringify(input);
    try {
      const view = createStarSystem(container, input, {
        scaleMode: p.scaleMode,
        showHabitableZone: p.showHabitableZone,
        rate: p.rate,
        overlays: p.overlays,
        autoplay: p.playing ?? p.autoplay,
        minPlanetPixels: p.minPlanetPixels,
        fallbackText: p.fallbackText,
      });
      view.onTick((days) => latest.current.props.onTick?.(days));
      if (savedTime.current > 0) view.setTime(savedTime.current);
      applied.current = {
        scaleMode: p.scaleMode,
        showHabitableZone: p.showHabitableZone,
        rate: p.rate,
        overlays: p.overlays,
      };
      viewRef.current = view;
    } catch (error) {
      p.onError?.(error);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    create(container);
    return () => {
      const view = viewRef.current;
      viewRef.current = null;
      if (view) {
        savedTime.current = view.time;
        view.destroy();
      }
    };
  }, [containerRef, autoplay, minPlanetPixels, fallbackText]);

  useEffect(() => {
    if (systemKey === attempted.current) return;
    const view = viewRef.current;
    if (!view) {
      if (containerRef.current) create(containerRef.current);
      return;
    }
    attempted.current = systemKey;
    try {
      view.setSystem(system);
    } catch (error) {
      latest.current.props.onError?.(error);
    }
  }, [systemKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || scaleMode === undefined || scaleMode === applied.current.scaleMode) return;
    view.setScaleMode(scaleMode);
    applied.current.scaleMode = scaleMode;
  }, [scaleMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || showHabitableZone === undefined || showHabitableZone === applied.current.showHabitableZone) return;
    view.setHabitableZoneVisible(showHabitableZone);
    applied.current.showHabitableZone = showHabitableZone;
  }, [showHabitableZone]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || rate === undefined || rate === applied.current.rate) return;
    view.setRate(rate);
    applied.current.rate = rate;
  }, [rate]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || overlays === undefined || sameOverlays(overlays, applied.current.overlays)) return;
    view.setOverlays(overlays);
    applied.current.overlays = overlays;
  });

  useEffect(() => {
    const view = viewRef.current;
    if (!view || playing === undefined || playing === view.playing) return;
    if (playing) view.play();
    else view.pause();
  }, [playing]);

  return useMemo<StarSystemHandle>(
    () => ({
      get view() {
        return viewRef.current;
      },
      play: () => viewRef.current?.play(),
      pause: () => viewRef.current?.pause(),
      setTime: (days) => viewRef.current?.setTime(days),
      setView: (preset) => viewRef.current?.setView(preset),
      resetView: () => viewRef.current?.resetView(),
    }),
    [],
  );
}
