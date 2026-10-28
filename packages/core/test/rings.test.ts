import { describe, expect, it } from 'vitest';
import { deriveSystem, ringDefaults, validateSystem, type PlanetInput } from '../src/physics.js';
import { fixture } from './fixture.js';

const giant = (extra: Partial<PlanetInput>, teq = 90): PlanetInput => ({ radius: 9, period: 10000, teq, ...extra });
const derive = (p: PlanetInput) => deriveSystem({ ...fixture, planets: [p] }).planets[0]!;
const issues = (p: Record<string, unknown>) =>
  validateSystem({ ...fixture, planets: [{ radius: 9, period: 100, ...p }] }).map((i) => `${i.path}: ${i.message}`);

describe('rings', () => {
  it('are never added on their own', () => {
    expect(derive(giant({})).rings).toBeNull();
    expect(derive(giant({ rings: false })).rings).toBeNull();
  });

  it('default to Saturn-like icy rings below 150 K', () => {
    expect(derive(giant({ rings: true }, 90)).rings).toEqual({ ...ringDefaults(90), seed: 11 });
    expect(ringDefaults(90)).toEqual({ inner: 1.2, outer: 2.3, colour: [222, 208, 180], opacity: 0.85, icy: true });
  });

  it('are dark and faint from 150 K, where ice would not survive', () => {
    expect(ringDefaults(150)).toEqual({ inner: 1.2, outer: 2.3, colour: [110, 98, 88], opacity: 0.35, icy: false });
    expect(derive(giant({ rings: true }, 400)).rings!.icy).toBe(false);
  });

  it('take every override as given', () => {
    const r = derive(giant({ rings: { inner: 1.5, outer: 3, colour: '#ff8000', opacity: 0.5 } })).rings!;
    expect(r).toMatchObject({ inner: 1.5, outer: 3, colour: [255, 128, 0], opacity: 0.5, icy: true });
  });

  it('keep defaults for what is not overridden', () => {
    expect(derive(giant({ rings: { outer: 2.8 } })).rings).toMatchObject({ inner: 1.2, outer: 2.8, opacity: 0.85 });
  });
});

describe('obliquity', () => {
  it('defaults to 0 and is kept as given', () => {
    expect(derive(giant({})).obliquity).toBe(0);
    expect(derive(giant({ obliquity: 26.7 })).obliquity).toBe(26.7);
  });
});

describe('validateSystem rings and obliquity', () => {
  it('accepts true, false and partial objects', () => {
    expect(issues({ rings: true })).toEqual([]);
    expect(issues({ rings: false })).toEqual([]);
    expect(issues({ rings: { outer: 2 } })).toEqual([]);
  });

  it('rejects other values', () => {
    expect(issues({ rings: 'yes' })).toEqual(['planets[0].rings: must be true, false or an object (got "yes")']);
  });

  it('needs 1 < inner < outer, with defaults filled in', () => {
    expect(issues({ rings: { inner: 0.9 } })).toEqual(['planets[0].rings.inner: must be greater than 1 (got 0.9)']);
    expect(issues({ rings: { inner: 2.5 } })).toEqual([
      'planets[0].rings: inner must be less than outer (got 2.5 and 2.3)',
    ]);
    expect(issues({ rings: { outer: -1 } })).toEqual(['planets[0].rings.outer: must be greater than 1 (got -1)']);
  });

  it('checks opacity and colour', () => {
    expect(issues({ rings: { opacity: 0 } })).toEqual(['planets[0].rings.opacity: must be a number in (0, 1] (got 0)']);
    expect(issues({ rings: { opacity: 1 } })).toEqual([]);
    expect(issues({ rings: { colour: 'tan' } })).toEqual([
      'planets[0].rings.colour: must be a hex colour such as "#ffcc88" (got "tan")',
    ]);
  });

  it('needs a finite obliquity', () => {
    expect(issues({ obliquity: 97.8 })).toEqual([]);
    expect(issues({ obliquity: Infinity })).toEqual(['planets[0].obliquity: must be a finite number (got Infinity)']);
  });
});
