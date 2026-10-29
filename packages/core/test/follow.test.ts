import { describe, expect, it } from 'vitest';
import { easeInOut, followDistance, pickPlanet } from '../src/render/follow.js';

describe('pickPlanet', () => {
  it('returns null when nothing is near the click', () => {
    expect(pickPlanet([{ x: 100, y: 100, r: 5 }], 300, 300)).toBeNull();
    expect(pickPlanet([], 0, 0)).toBeNull();
  });

  it('hits a disc, or a small planet within the minimum tolerance', () => {
    expect(pickPlanet([{ x: 100, y: 100, r: 30 }], 125, 100)).toBe(0);
    expect(pickPlanet([{ x: 100, y: 100, r: 1 }], 110, 100)).toBe(0);
    expect(pickPlanet([{ x: 100, y: 100, r: 1 }], 120, 100)).toBeNull();
  });

  it('prefers the planet whose edge is closest, and skips hidden ones', () => {
    const pts = [
      { x: 100, y: 100, r: 2 },
      { x: 108, y: 100, r: 2 },
      null,
    ];
    expect(pickPlanet(pts, 106, 100)).toBe(1);
    expect(pickPlanet(pts, 101, 100)).toBe(0);
  });
});

describe('followDistance', () => {
  it('frames the planet so its extent fills a fixed share of the view height', () => {
    const fov = 45;
    const d = followDistance(1, fov);
    const fill = 1 / (d * Math.tan((fov * Math.PI) / 360));
    expect(fill).toBeCloseTo(0.3, 6);
    expect(followDistance(2, fov)).toBeCloseTo(2 * d, 6);
  });
});

describe('easeInOut', () => {
  it('runs from 0 to 1 and clamps outside', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(2)).toBe(1);
  });
});
