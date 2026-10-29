import type { Rgb } from './appearance.js';
import { parseHexColour } from './colour.js';
import type { RingsInput } from './types.js';

/** A planet's rings, radii in planet radii. */
export interface DerivedRings {
  inner: number;
  outer: number;
  colour: Rgb;
  /** 0 (invisible) to 1 (opaque). */
  opacity: number;
  /** True when Teq is below 150 K, where water ice survives. */
  icy: boolean;
  /** Seed for the ringlet pattern. */
  seed: number;
}

/** Default ring inner and outer radius in planet radii: Saturn's main rings, inside the Roche limit. */
export const RING_INNER = 1.2;
export const RING_OUTER = 2.3;

const ICE_LIMIT_K = 150;

/**
 * Ring defaults for a planet's Teq: icy, bright and mostly opaque below 150 K (like Saturn's),
 * else dark, dusty and faint (like Jupiter's, Uranus's and Neptune's).
 */
export function ringDefaults(teq: number): Omit<DerivedRings, 'seed'> {
  const icy = teq < ICE_LIMIT_K;
  return {
    inner: RING_INNER,
    outer: RING_OUTER,
    colour: icy ? [222, 208, 180] : [110, 98, 88],
    opacity: icy ? 0.85 : 0.35,
    icy,
  };
}

/** Rings from validated input, or null when the planet has none. */
export function deriveRings(input: boolean | RingsInput | undefined, teq: number, seed: number): DerivedRings | null {
  if (!input) return null;
  const d = ringDefaults(teq);
  if (input === true) return { ...d, seed };
  return {
    inner: input.inner ?? d.inner,
    outer: input.outer ?? d.outer,
    colour: input.colour === undefined ? d.colour : (parseHexColour(input.colour)!.map((v) => v * 255) as Rgb),
    opacity: input.opacity ?? d.opacity,
    icy: d.icy,
    seed,
  };
}
