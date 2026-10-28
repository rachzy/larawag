import { describe, expect, it } from 'vitest';
import { LarawagValidationError, validateSystem } from '../src/physics/validate.js';
import { fixture } from './fixture.js';

const clone = () => structuredClone(fixture) as any;
const find = (input: unknown, path: string) => validateSystem(input).find((i) => i.path === path);

describe('validateSystem', () => {
  it('accepts the fixture', () => expect(validateSystem(fixture)).toEqual([]));

  it('rejects a negative star radius', () => {
    const s = clone();
    s.star.radius = -1;
    const issue = find(s, 'star.radius');
    expect(issue?.message).toContain('positive');
  });

  it('needs period or a', () => {
    const s = clone();
    s.planets[0] = { radius: 1 };
    expect(validateSystem(s)).toContainEqual({ path: 'planets[0]', message: 'needs period or a' });
  });

  it('accepts a only, or both', () => {
    const s = clone();
    s.planets[0] = { radius: 1, a: 0.05 };
    s.planets[1] = { radius: 1, a: 0.05, period: 4 };
    expect(validateSystem(s)).toEqual([]);
  });

  it('reports the offending value with the index', () => {
    const s = clone();
    s.planets[1].radius = -2;
    expect(validateSystem(s)).toContainEqual({
      path: 'planets[1].radius',
      message: 'must be a positive number (got -2)',
    });
  });

  it('rejects NaN, Infinity and numeric strings', () => {
    for (const bad of [NaN, Infinity, '1.5']) {
      const s = clone();
      s.planets[0].radius = bad;
      expect(find(s, 'planets[0].radius')).toBeDefined();
    }
    const s = clone();
    s.star.teff = '5100';
    expect(find(s, 'star.teff')).toBeDefined();
  });

  it('checks albedo in [0, 1)', () => {
    const s = clone();
    s.planets[0].albedo = 1;
    expect(find(s, 'planets[0].albedo')).toBeDefined();
    s.planets[0].albedo = 0.3;
    expect(validateSystem(s)).toEqual([]);
    s.planets[0].albedo = 0;
    expect(validateSystem(s)).toEqual([]);
  });

  it('checks phase is finite', () => {
    const s = clone();
    s.planets[0].phase = 0;
    expect(validateSystem(s)).toEqual([]);
    s.planets[0].phase = NaN;
    expect(find(s, 'planets[0].phase')).toBeDefined();
  });

  it('rejects unknown planetClass', () => {
    const s = clone();
    s.planets[0].planetClass = 'ice-giant';
    expect(find(s, 'planets[0].planetClass')).toBeDefined();
    s.planets[0].planetClass = 'gas-giant';
    expect(validateSystem(s)).toEqual([]);
  });

  it('rejects non-array planets and accepts empty', () => {
    const s = clone();
    s.planets = {};
    expect(find(s, 'planets')).toBeDefined();
    s.planets = [];
    expect(validateSystem(s)).toEqual([]);
  });

  it('reports non-object input instead of throwing', () => {
    for (const bad of [null, undefined, 3, 'x', []]) {
      expect(validateSystem(bad).length).toBeGreaterThan(0);
    }
    expect(find({ planets: [] }, 'star')).toBeDefined();
    expect(find({ star: fixture.star }, 'planets')).toBeDefined();
    expect(find({ star: fixture.star, planets: [null] }, 'planets[0]')).toBeDefined();
  });

  it('validates overrides when present', () => {
    const s = clone();
    Object.assign(s.planets[0], { aOverRs: -1, rpOverRs: 0, velocity: NaN, insolation: -3, teq: Infinity, seed: 'x' });
    Object.assign(s.star, { luminosity: -1 });
    const paths = validateSystem(s).map((i) => i.path);
    for (const p of ['aOverRs', 'rpOverRs', 'velocity', 'insolation', 'teq', 'seed'])
      expect(paths).toContain(`planets[0].${p}`);
    expect(paths).toContain('star.luminosity');
  });

  it('validates habitableZone', () => {
    const s = clone();
    s.star.habitableZone = { inner: 1, outer: 0.5 };
    expect(find(s, 'star.habitableZone')).toBeDefined();
    s.star.habitableZone = { inner: -1, outer: 2 };
    expect(find(s, 'star.habitableZone.inner')).toBeDefined();
    s.star.habitableZone = { inner: 0.6, outer: 1 };
    expect(validateSystem(s)).toEqual([]);
    s.star.habitableZone = 5;
    expect(find(s, 'star.habitableZone')).toBeDefined();
  });

  it('collects all issues', () => {
    const s = clone();
    s.star.radius = -1;
    s.star.mass = 0;
    s.planets[0].radius = -2;
    expect(validateSystem(s)).toHaveLength(3);
  });
});

describe('LarawagValidationError', () => {
  it('carries issues and is instanceof', () => {
    const issues = [{ path: 'star.radius', message: 'must be a positive number (got -1)' }];
    const e = new LarawagValidationError(issues);
    expect(e).toBeInstanceOf(LarawagValidationError);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('LarawagValidationError');
    expect(e.issues).toBe(issues);
    expect(e.message).toContain('star.radius: must be a positive number (got -1)');
  });
});
