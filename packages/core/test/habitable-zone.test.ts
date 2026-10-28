import { describe, expect, it } from 'vitest';
import { habitableZone } from '../src/physics.js';
import { fixture } from './fixture.js';

describe('habitableZone', () => {
  it('matches the approximate model for the fixture star', () => {
    const hz = habitableZone(fixture.star);
    expect(hz.inner).toBeCloseTo(0.595, 3);
    expect(hz.outer).toBeCloseTo(1.041, 3);
  });

  it('uses a luminosity override', () => {
    const hz = habitableZone({ ...fixture.star, luminosity: 1 });
    expect(hz.inner).toBeCloseTo(Math.sqrt(1 / 1.1), 6);
    expect(hz.outer).toBeCloseTo(Math.sqrt(1 / 0.36), 6);
  });

  it('accepts the model name explicitly', () => {
    expect(habitableZone(fixture.star, 'approximate')).toEqual(habitableZone(fixture.star));
  });
});
