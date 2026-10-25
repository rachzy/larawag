import { TEFF_SUN } from './constants.js';

/** Habitable-zone model. Only `'approximate'` is available. */
export type HzModel = 'approximate';

const SEFF_INNER = 1.1;
const SEFF_OUTER = 0.36;

/**
 * Habitable zone edges in AU. The approximate model takes L = R² (Teff/5772)⁴
 * (or `star.luminosity`) and d = √(L / Seff), with Seff 1.1 inner and 0.36 outer.
 */
export function habitableZone(
  star: { teff: number; radius: number; luminosity?: number },
  model: HzModel = 'approximate',
): { inner: number; outer: number } {
  void model;
  const lum = star.luminosity ?? star.radius * star.radius * Math.pow(star.teff / TEFF_SUN, 4);
  return { inner: Math.sqrt(lum / SEFF_INNER), outer: Math.sqrt(lum / SEFF_OUTER) };
}
