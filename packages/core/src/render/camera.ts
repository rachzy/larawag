import type { ScaleMode } from './scales.js';

/** Camera position for a named view, multiplied by `fit`. */
export function cameraPreset(
  mode: ScaleMode,
  kind: 'home' | 'transit',
  fit = 1,
): [number, number, number] {
  const base: [number, number, number] =
    mode === 'compressed'
      ? kind === 'home' ? [0, 15, 32] : [48, 0.4, 0]
      : kind === 'home' ? [0, 45, 95] : [160, 0.2, 0];
  return [base[0] * fit, base[1] * fit, base[2] * fit];
}

/**
 * Scale factor for systems wider than the example: 1 up to the reference
 * outer orbit (16 compressed, 36 true), proportional beyond.
 */
export function cameraFit(mode: ScaleMode, outerOrbitRadius: number): number {
  const ref = mode === 'compressed' ? 16 : 36;
  return Math.max(1, outerOrbitRadius / ref);
}
