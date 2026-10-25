import { AU_PER_RSUN } from '../physics/constants.js';

/** Scene scale: log-compressed distances, or true proportions. */
export type ScaleMode = 'compressed' | 'true';

const compress = (au: number): number => 5 + 8 * Math.log(1 + au / 0.05);

/** Orbit radius in scene units. `aOverRs` is the semi-major axis in stellar radii. */
export function orbitRadius(mode: ScaleMode, aAu: number, aOverRs: number): number {
  return mode === 'compressed' ? compress(aAu) : aOverRs;
}

/** Habitable-zone edge radius in scene units. */
export function hzRadius(mode: ScaleMode, au: number, starRadiusSolar: number): number {
  return mode === 'compressed' ? compress(au) : (au * AU_PER_RSUN) / starRadiusSolar;
}

/** Star sphere radius and glow sprite scale for the mode. */
export function starScene(mode: ScaleMode): { starRadius: number; glowScale: number } {
  return mode === 'compressed' ? { starRadius: 2, glowScale: 12 } : { starRadius: 1, glowScale: 7 };
}

/**
 * Planet display radius. In true mode, when `minPlanetPixels > 0` the radius is
 * raised so the planet is at least that many pixels across (`pixelsPerUnit`
 * is the on-screen size of one scene unit).
 */
export function planetRadius(
  mode: ScaleMode,
  rpEarth: number,
  rpOverRs: number,
  minPlanetPixels: number,
  pixelsPerUnit = 1,
): number {
  if (mode === 'compressed') return 0.35 + 0.18 * rpEarth ** 0.6;
  if (minPlanetPixels > 0 && pixelsPerUnit > 0) {
    return Math.max(rpOverRs, minPlanetPixels / (2 * pixelsPerUnit));
  }
  return rpOverRs;
}
