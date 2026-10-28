import { describe, expect, it } from 'vitest';
import { classifyPlanet, deriveSystem } from '../src/physics.js';

describe('classifyPlanet', () => {
  it('uses thresholds 1.6 and 6', () => {
    expect(classifyPlanet(1.59)).toBe('rocky');
    expect(classifyPlanet(1.6)).toBe('neptune-like');
    expect(classifyPlanet(4.5)).toBe('neptune-like');
    expect(classifyPlanet(5.99)).toBe('neptune-like');
    expect(classifyPlanet(6)).toBe('gas-giant');
  });

  it('keeps the Solar System planets in their classes', () => {
    const radii = [0.383, 0.95, 1, 0.532, 10.97, 9.14, 3.98, 3.86];
    expect(radii.map(classifyPlanet)).toEqual([
      'rocky', 'rocky', 'rocky', 'rocky', 'gas-giant', 'gas-giant', 'neptune-like', 'neptune-like',
    ]);
  });

  it('never guesses an ocean world', () => {
    for (let r = 0.1; r < 30; r += 0.1) expect(classifyPlanet(r)).not.toBe('ocean-world');
  });
});

describe('planetClass input', () => {
  it('keeps an explicit ocean-world', () => {
    const d = deriveSystem({
      star: { teff: 5772, radius: 1, mass: 1 },
      planets: [{ radius: 1.5, period: 365, planetClass: 'ocean-world' }],
    });
    expect(d.planets[0]!.planetClass).toBe('ocean-world');
  });
});
