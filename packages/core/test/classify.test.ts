import { describe, expect, it } from 'vitest';
import { classifyPlanet } from '../src/physics.js';

describe('classifyPlanet', () => {
  it('uses thresholds 1.6 and 4', () => {
    expect(classifyPlanet(1.59)).toBe('rocky');
    expect(classifyPlanet(1.6)).toBe('neptune-like');
    expect(classifyPlanet(3.99)).toBe('neptune-like');
    expect(classifyPlanet(4)).toBe('gas-giant');
  });
});
