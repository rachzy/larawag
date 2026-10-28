import { describe, expect, it } from 'vitest';
import {
  aOverRs,
  equilibriumTemp,
  insolation,
  orbitalSpeedKmS,
  periodDaysFromAu,
  rpOverRs,
  semiMajorAxisAu,
} from '../src/physics.js';
import { fixture } from './fixture.js';

const { star } = fixture;
const [b, c] = fixture.planets;

describe('kepler', () => {
  it('semi-major axis matches the fixture', () => {
    expect(semiMajorAxisAu(star.mass, b.period!)).toBeCloseTo(0.0483, 4);
    expect(semiMajorAxisAu(star.mass, c.period!)).toBeCloseTo(0.1297, 4);
  });

  it('period round-trips', () => {
    const a = semiMajorAxisAu(0.85, 4.2);
    expect(periodDaysFromAu(0.85, a)).toBeCloseTo(4.2, 10);
  });

  it('a / R*', () => {
    const ab = semiMajorAxisAu(star.mass, b.period!);
    const ac = semiMajorAxisAu(star.mass, c.period!);
    expect(aOverRs(ab, star.radius)).toBeCloseTo(12.97, 2);
    expect(aOverRs(ac, star.radius)).toBeCloseTo(34.86, 2);
  });

  it('Rp / R*', () => {
    expect(rpOverRs(1.5, 0.8)).toBeCloseTo(1.5 / 109.1 / 0.8, 10);
  });

  it('orbital speed', () => {
    const ab = semiMajorAxisAu(star.mass, b.period!);
    expect(orbitalSpeedKmS(star.mass, ab)).toBeCloseTo(29.78 * Math.sqrt(0.85 / ab), 8);
    expect(orbitalSpeedKmS(1, 1)).toBeCloseTo(29.78, 2);
  });

  it('insolation matches an independent computation', () => {
    const ab = semiMajorAxisAu(star.mass, b.period!);
    // Independent route: L = R^2 (T/Tsun)^4, S = L / a^2, with a from P^2 = a^3 / M (years).
    const aIndep = Math.pow(0.85 * (4.2 / 365.25) ** 2, 1 / 3);
    const L = 0.64 * (5100 / 5772) ** 4;
    expect(insolation(star.radius, star.teff, ab)).toBeCloseTo(L / aIndep ** 2, 6);
    expect(insolation(star.radius, star.teff, ab)).toBeGreaterThan(160);
    expect(insolation(star.radius, star.teff, ab)).toBeLessThan(175);
    expect(insolation(1, 5772, 1)).toBeCloseTo(1, 10);
  });

  it('equilibrium temperature within 1 K of the fixture', () => {
    const ab = semiMajorAxisAu(star.mass, b.period!);
    const ac = semiMajorAxisAu(star.mass, c.period!);
    expect(Math.abs(equilibriumTemp(star.teff, star.radius, ab, 0.3) - 915.9)).toBeLessThan(1);
    expect(Math.abs(equilibriumTemp(star.teff, star.radius, ac, 0.3) - 558.7)).toBeLessThan(1);
  });
});
