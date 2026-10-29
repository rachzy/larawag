import { describe, expect, it } from 'vitest';
import {
  AU_PER_RSUN,
  blackbodyColour,
  deriveSystem,
  equilibriumTemp,
  habitableZone,
  semiMajorAxisAu,
  starLuminosity,
  validateSystem,
  type SystemInput,
} from '../src/physics.js';
import { fixture } from './fixture.js';

const A = { name: 'A', teff: 5800, radius: 1.1, mass: 1.1 };
const B = { name: 'B', teff: 4400, radius: 0.7, mass: 0.7 };
const binary = (extra: Partial<SystemInput> = {}): SystemInput => ({
  stars: [A, B],
  binary: { separation: 0.2 },
  planets: [{ name: 'p', period: 300, radius: 2 }],
  ...extra,
});
const issues = (input: unknown) => validateSystem(input).map((i) => `${i.path}: ${i.message}`);

describe('deriveSystem with two stars', () => {
  const d = deriveSystem(binary());
  const lA = starLuminosity(A.teff, A.radius);
  const lB = starLuminosity(B.teff, B.radius);

  it('derives each star on its own', () => {
    expect(d.stars.map((s) => s.name)).toEqual(['A', 'B']);
    expect(d.stars[1]!.colour).toEqual(blackbodyColour(4400));
    expect(d.stars[0]!.luminosity).toBeCloseTo(lA, 10);
  });

  it('treats the pair as one star with summed mass and light, and star A as the radius unit', () => {
    expect(d.star.mass).toBeCloseTo(1.8, 10);
    expect(d.star.luminosity).toBeCloseTo(lA + lB, 10);
    expect(d.star.radius).toBe(1.1);
    expect(starLuminosity(d.star.teff, d.star.radius)).toBeCloseTo(lA + lB, 10);
    expect(d.star.name).toBe('A + B');
    expect(d.star.spectralType).toBeNull();
  });

  it('orbits planets around the combined star', () => {
    const p = d.planets[0]!;
    expect(p.aAu).toBeCloseTo(semiMajorAxisAu(1.8, 300), 10);
    expect(p.insolation).toBeCloseTo((lA + lB) / (p.aAu * p.aAu), 10);
    expect(p.teq).toBeCloseTo(equilibriumTemp(d.star.teff, 1.1, p.aAu, 0.3), 6);
    expect(p.aOverRs).toBeCloseTo((p.aAu * AU_PER_RSUN) / 1.1, 6);
  });

  it('puts the habitable zone around the combined light', () => {
    expect(d.habitableZone.inner).toBeCloseTo(habitableZone({ teff: 1, radius: 1, luminosity: lA + lB }).inner, 10);
  });

  it('gives the binary orbit: separation, period and each star’s distance from the centre of mass', () => {
    expect(d.binary!.separation).toBe(0.2);
    expect(d.binary!.periodDays).toBeCloseTo(365.25 * Math.sqrt(0.2 ** 3 / 1.8), 8);
    expect(d.binary!.distances[0]).toBeCloseTo((0.2 * 0.7) / 1.8, 10);
    expect(d.binary!.distances[1]).toBeCloseTo((0.2 * 1.1) / 1.8, 10);
    expect(d.binary!.phase).toBe(0);
  });

  it('defaults the separation to four times the summed radii', () => {
    const s = deriveSystem(binary({ binary: {} })).binary!.separation;
    expect(s).toBeCloseTo((4 * (1.1 + 0.7)) / AU_PER_RSUN, 10);
    expect(deriveSystem(binary({ binary: undefined })).binary!.separation).toBeCloseTo(s, 10);
  });

  it('keeps a habitable zone override and names default to A and B', () => {
    const hz = { inner: 1, outer: 2 };
    const e = deriveSystem(binary({ stars: [{ teff: 5800, radius: 1.1, mass: 1.1 }, { spectralType: 'K5V' }], binary: { habitableZone: hz } }));
    expect(e.habitableZone).toEqual(hz);
    expect(e.stars.map((s) => s.name)).toEqual(['Star A', 'Star B']);
    expect(e.stars[1]!.teff).toBe(4440);
  });

  it('still has one star and no binary for a single star', () => {
    const f = deriveSystem(fixture);
    expect(f.stars).toHaveLength(1);
    expect(f.stars[0]).toEqual(f.star);
    expect(f.binary).toBeNull();
  });
});

describe('validateSystem with two stars', () => {
  it('accepts two stars', () => expect(issues(binary())).toEqual([]));

  it('wants star or stars, not both or neither', () => {
    expect(issues({ ...binary(), star: A })).toEqual(['stars: give either star or stars, not both']);
    expect(issues({ planets: [] })).toEqual(['star: must be an object']);
  });

  it('wants exactly two stars', () => {
    expect(issues(binary({ stars: [A] }))).toEqual(['stars: must list exactly 2 stars (got 1)']);
    expect(issues(binary({ stars: [A, B, A] }))).toEqual(['stars: must list exactly 2 stars (got 3)']);
    expect(issues({ ...binary(), stars: 'AB' })).toEqual(['stars: must list exactly 2 stars (got "AB")']);
  });

  it('checks each star with its own path', () => {
    expect(issues(binary({ stars: [A, { ...B, mass: -1 }] }))).toEqual([
      'stars[1].mass: must be a positive number (got -1)',
    ]);
    expect(issues(binary({ stars: [A, { spectralType: 'Q1' }] }))).toEqual([
      'stars[1].spectralType: must be a spectral type such as "G2V" (got "Q1")',
    ]);
  });

  it('moves the habitable zone override to binary', () => {
    expect(issues(binary({ stars: [{ ...A, habitableZone: { inner: 1, outer: 2 } }, B] }))).toEqual([
      'stars[0].habitableZone: use binary.habitableZone with two stars',
    ]);
    expect(issues(binary({ binary: { habitableZone: { inner: 2, outer: 1 } } }))).toEqual([
      'binary.habitableZone: inner must be less than outer (got 2 and 1)',
    ]);
  });

  it('checks the binary orbit', () => {
    expect(issues(binary({ binary: { separation: 0 } }))).toEqual(['binary.separation: must be a positive number (got 0)']);
    expect(issues(binary({ binary: { phase: NaN } }))).toEqual(['binary.phase: must be a finite number (got NaN)']);
    expect(issues({ ...fixture, binary: { separation: 1 } })).toEqual(['binary: only with stars']);
  });
});
