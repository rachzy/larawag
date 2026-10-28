import { describe, expect, it } from 'vitest';
import { blackbodyColour, deriveSystem, LarawagValidationError, type SystemInput } from '../src/physics.js';
import { fixture } from './fixture.js';

const star = fixture.star;
const one = (planet: SystemInput['planets'][number], s = star) => deriveSystem({ star: s, planets: [planet] }).planets[0]!;

describe('deriveSystem', () => {
  it('derives the fixture planets', () => {
    const d = deriveSystem(fixture);
    const [b, c] = d.planets;
    expect(b!.name).toBe('b');
    expect(c!.name).toBe('c');
    expect(b!.aAu).toBeCloseTo(0.0483, 4);
    expect(b!.aOverRs).toBeCloseTo(12.97, 2);
    expect(b!.teq).toBeCloseTo(915.9, 1);
    expect(c!.aAu).toBeCloseTo(0.1297, 4);
    expect(c!.aOverRs).toBeCloseTo(34.86, 2);
    expect(c!.teq).toBeCloseTo(558.7, 1);
    expect(b!.planetClass).toBe('rocky');
    expect(c!.planetClass).toBe('neptune-like');
    expect(b!.colour).toBe('#c8a27a');
    expect(c!.colour).toBe('#7fb7d9');
    expect([b!.seed, c!.seed]).toEqual([11, 16]);
    expect([b!.phase, c!.phase]).toEqual([0, 0]);
    expect(b!.radiusEarth).toBe(1.5);
    expect(b!.periodDays).toBe(4.2);
  });

  it('derives the star', () => {
    const d = deriveSystem(fixture);
    expect(d.star).toMatchObject({ name: 'Star', teff: 5100, radius: 0.8, mass: 0.85 });
    expect(d.star.luminosity).toBeCloseTo(0.39, 2);
    expect(d.star.colourCss).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    expect(d.star.colour).toHaveLength(3);
    expect(d.habitableZone.inner).toBeCloseTo(0.595, 3);
    expect(d.habitableZone.outer).toBeCloseTo(1.041, 3);
  });

  it('keeps a luminosity override', () => {
    expect(deriveSystem({ ...fixture, star: { ...star, luminosity: 2 } }).star.luminosity).toBe(2);
  });

  it('returns every override verbatim', () => {
    const hz = { inner: 0.5, outer: 2 };
    const d = deriveSystem({
      star: { ...star, habitableZone: hz },
      planets: [
        {
          radius: 1.5, period: 4.2, aOverRs: 99, rpOverRs: 0.5, velocity: 7, insolation: 3, teq: 123,
          planetClass: 'gas-giant', seed: 42, name: 'Zed', phase: 1.25,
        },
      ],
    });
    expect(d.habitableZone).toEqual(hz);
    expect(d.planets[0]).toMatchObject({
      aOverRs: 99, rpOverRs: 0.5, velocityKmS: 7, insolation: 3, teq: 123,
      planetClass: 'gas-giant', seed: 42, name: 'Zed', phase: 1.25,
    });
  });

  it('derives the period from a alone', () => {
    const p = one({ radius: 1, a: 1 }, { teff: 5772, radius: 1, mass: 1 });
    expect(p.aAu).toBe(1);
    expect(p.periodDays).toBeCloseTo(365.25, 6);
  });

  it('keeps both period and a when both are given', () => {
    const p = one({ radius: 1, period: 10, a: 0.5 });
    expect(p.periodDays).toBe(10);
    expect(p.aAu).toBe(0.5);
    expect(p.velocityKmS).toBeCloseTo(29.78 * Math.sqrt(0.85 / 0.5), 6);
  });

  it('uses the albedo for teq', () => {
    expect(one({ radius: 1, period: 4.2, albedo: 0 }).teq).toBeGreaterThan(one({ radius: 1, period: 4.2 }).teq);
  });

  it('uses a luminosity override for insolation', () => {
    const base = one({ radius: 1, a: 1 });
    const bright = one({ radius: 1, a: 1 }, { ...star, luminosity: 4 });
    expect(bright.insolation).toBeCloseTo(4, 6);
    expect(base.insolation).toBeCloseTo(0.39, 2);
  });

  it('names and colours more planets', () => {
    const d = deriveSystem({ star, planets: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ radius: 1, period: n })) });
    expect(d.planets.map((p) => p.name)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(d.planets[2]!.colour).not.toBe('#c8a27a');
    expect(d.planets[2]!.colour).not.toBe('#7fb7d9');
    expect(new Set(d.planets.slice(0, 6).map((p) => p.colour)).size).toBe(6);
    expect(d.planets[6]!.colour).toBe(d.planets[0]!.colour);
    expect(d.planets[2]!.seed).toBe(21);
  });

  it('names planets past z', () => {
    const d = deriveSystem({ star, planets: Array.from({ length: 27 }, () => ({ radius: 1, period: 5 })) });
    expect(d.planets[24]!.name).toBe('z');
    expect(d.planets[25]!.name).toBe('planet 26');
  });

  it('accepts zero planets', () => {
    expect(deriveSystem({ star, planets: [] }).planets).toEqual([]);
  });

  it('throws LarawagValidationError for invalid input', () => {
    expect(() => deriveSystem({ star: { ...star, teff: -1 }, planets: [] })).toThrow(LarawagValidationError);
    expect(() => deriveSystem(null as never)).toThrow(LarawagValidationError);
  });

  it('takes the star from its spectral type', () => {
    const d = deriveSystem({ star: { spectralType: 'G2V' }, planets: [] });
    expect(d.star).toMatchObject({ teff: 5770, radius: 1.012, mass: 1.0, spectralType: 'G2V' });
    expect(d.star.colour).toEqual(blackbodyColour(5770));
  });

  it('keeps given values over the spectral type, colour included', () => {
    const d = deriveSystem({ star: { spectralType: 'G2V', teff: 6000 }, planets: [] });
    expect(d.star.teff).toBe(6000);
    expect(d.star.radius).toBe(1.012);
    expect(d.star.colour).toEqual(blackbodyColour(6000));
  });

  it('uses the dwarf table teff for a giant', () => {
    const d = deriveSystem({ star: { spectralType: 'K0III', radius: 11, mass: 1.5 }, planets: [] });
    expect(d.star).toMatchObject({ teff: 5270, radius: 11, mass: 1.5 });
  });

  it('keeps a colour override', () => {
    const d = deriveSystem({ star: { ...star, colour: '#ff8000' }, planets: [] });
    expect(d.star.colour).toEqual([1, 128 / 255, 0]);
    expect(d.star.colourCss).toBe('rgb(255,128,0)');
  });

  it('has no spectral type when none is given', () => {
    expect(deriveSystem(fixture).star.spectralType).toBeNull();
  });

  it('derives Earth and Neptune of the Solar System', () => {
    const d = deriveSystem({
      star: { name: 'Sun', teff: 5772, radius: 1, mass: 1 },
      planets: [
        { name: 'Earth', radius: 1, period: 365.25 },
        { name: 'Neptune', radius: 3.88, period: 60190 },
      ],
    });
    expect(d.planets[0]!.aAu).toBeCloseTo(1.0, 3);
    expect(d.planets[0]!.periodDays).toBe(365.25);
    expect(d.planets[1]!.aAu).toBeCloseTo(30.1, 1);
    expect(d.star.luminosity).toBeCloseTo(1, 6);
  });
});
