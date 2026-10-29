import { vi } from 'vitest';
import type { StarSystemView, SystemInput, ViewOptions } from '@larawag/core';

export interface FakeView extends Omit<StarSystemView, 'playing'> {
  playing: boolean;
  container: HTMLElement;
  input: SystemInput;
  options: ViewOptions;
  destroyed: boolean;
  ticks: Set<(days: number) => void>;
  tick(days: number): void;
}

export const created: FakeView[] = [];

/** A stand-in for `createStarSystem` that records every call. */
export const createStarSystem = vi.fn((container: HTMLElement, input: SystemInput, options: ViewOptions = {}) => {
  if ((input as { invalid?: boolean }).invalid) throw new Error('invalid system');
  let time = 0;
  const ticks = new Set<(days: number) => void>();
  const view: FakeView = {
    container,
    input,
    options,
    destroyed: false,
    ticks,
    system: {} as StarSystemView['system'],
    playing: options.autoplay ?? true,
    rate: 1,
    scaleMode: options.scaleMode ?? 'compressed',
    get time() {
      return time;
    },
    play: vi.fn(() => {
      view.playing = true;
    }),
    pause: vi.fn(() => {
      view.playing = false;
    }),
    setRate: vi.fn(),
    setTime: vi.fn((d: number) => {
      time = d;
    }),
    setScaleMode: vi.fn(),
    setHabitableZoneVisible: vi.fn(),
    setView: vi.fn(),
    resetView: vi.fn(),
    setSystem: vi.fn((next: SystemInput) => {
      if ((next as { invalid?: boolean }).invalid) throw new Error('invalid system');
    }),
    setOverlays: vi.fn(),
    onTick: vi.fn((cb: (days: number) => void) => {
      ticks.add(cb);
      return () => ticks.delete(cb);
    }),
    destroy: vi.fn(() => {
      view.destroyed = true;
    }),
    tick(days: number) {
      for (const cb of ticks) cb(days);
    },
  };
  created.push(view);
  return view;
});

/** Views not yet destroyed. */
export const live = (): FakeView[] => created.filter((v) => !v.destroyed);

export function resetFake(): void {
  created.length = 0;
  createStarSystem.mockClear();
}
