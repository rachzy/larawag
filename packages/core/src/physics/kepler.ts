import { AU_PER_RSUN, REARTH_PER_RSUN, TEFF_SUN } from './constants.js';

/** Semi-major axis in AU from stellar mass (M☉) and period (days), Kepler's third law. */
export function semiMajorAxisAu(massSolar: number, periodDays: number): number {
  return Math.cbrt(massSolar * Math.pow(periodDays / 365.25, 2));
}

/** Orbital period in days from stellar mass (M☉) and semi-major axis (AU). */
export function periodDaysFromAu(massSolar: number, aAu: number): number {
  return 365.25 * Math.sqrt(Math.pow(aAu, 3) / massSolar);
}

/** Semi-major axis in stellar radii. */
export function aOverRs(aAu: number, radiusSolar: number): number {
  return (aAu * AU_PER_RSUN) / radiusSolar;
}

/** Planet radius (R⊕) in stellar radii. */
export function rpOverRs(rpEarth: number, radiusSolar: number): number {
  return rpEarth / REARTH_PER_RSUN / radiusSolar;
}

/** Circular orbital speed in km/s. */
export function orbitalSpeedKmS(massSolar: number, aAu: number): number {
  return 29.78 * Math.sqrt(massSolar / aAu);
}

/** Stellar flux at the planet relative to Earth's. */
export function insolation(radiusSolar: number, teff: number, aAu: number): number {
  return (radiusSolar * radiusSolar * Math.pow(teff / TEFF_SUN, 4)) / (aAu * aAu);
}

/** Equilibrium temperature in K for a Bond albedo, full heat redistribution. */
export function equilibriumTemp(teff: number, radiusSolar: number, aAu: number, albedo: number): number {
  return teff * Math.sqrt(radiusSolar / AU_PER_RSUN / (2 * aAu)) * Math.pow(1 - albedo, 0.25);
}
