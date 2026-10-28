import { describe, expect, it } from 'vitest';
import { cameraFit, cameraPreset } from '../src/render/camera.js';
import { hzRadius, orbitRadius, planetRadius, starScene } from '../src/render/scales.js';
import { spreadLabels } from '../src/render/labels.js';

describe('scales', () => {
  it('orbitRadius compressed and true', () => {
    expect(orbitRadius('compressed', 0.0483, 12.97)).toBeCloseTo(5 + 8 * Math.log(1 + 0.0483 / 0.05), 10);
    expect(orbitRadius('true', 0.0483, 12.97)).toBe(12.97);
  });
  it('hzRadius compressed and true', () => {
    expect(hzRadius('compressed', 0.1, 0.8)).toBeCloseTo(5 + 8 * Math.log(1 + 2), 10);
    expect(hzRadius('true', 0.5, 0.8)).toBeCloseTo((0.5 * 215.032) / 0.8, 10);
  });
  it('starScene', () => {
    expect(starScene('compressed')).toEqual({ starRadius: 2, glowScale: 12 });
    expect(starScene('true')).toEqual({ starRadius: 1, glowScale: 7 });
  });
  it('planetRadius', () => {
    expect(planetRadius('compressed', 1.5, 0.0125, 0)).toBeCloseTo(0.35 + 0.18 * 1.5 ** 0.6, 10);
    expect(planetRadius('compressed', 3.6, 0.03, 0)).toBeCloseTo(0.35 + 0.18 * 3.6 ** 0.6, 10);
    expect(planetRadius('true', 1.5, 0.0172, 0)).toBe(0.0172);
  });
  it('minPlanetPixels raises a speck in true mode, inert at 0 and in compressed', () => {
    expect(planetRadius('true', 1.5, 0.0172, 4, 10)).toBeCloseTo(0.2, 10);
    expect(planetRadius('true', 1.5, 0.0172, 0, 10)).toBe(0.0172);
    expect(planetRadius('true', 1.5, 5, 4, 10)).toBe(5);
    expect(planetRadius('compressed', 1.5, 0.0172, 50, 10)).toBeCloseTo(0.35 + 0.18 * 1.5 ** 0.6, 10);
  });
});

describe('camera', () => {
  it('presets, scaled by fit', () => {
    expect(cameraPreset('compressed', 'home')).toEqual([0, 15, 32]);
    expect(cameraPreset('compressed', 'transit')).toEqual([48, 0.4, 0]);
    expect(cameraPreset('true', 'home')).toEqual([0, 45, 95]);
    expect(cameraPreset('true', 'transit')).toEqual([160, 0.2, 0]);
    expect(cameraPreset('compressed', 'home', 2)).toEqual([0, 30, 64]);
  });
  it('cameraFit is 1 for the example system and about 3.5 for the Solar System', () => {
    expect(cameraFit('compressed', orbitRadius('compressed', 0.1297, 34.86))).toBe(1);
    expect(cameraFit('true', 34.86)).toBe(1);
    expect(cameraFit('compressed', orbitRadius('compressed', 30.07, 6465))).toBeCloseTo(3.5, 1);
  });
});

describe('spreadLabels', () => {
  it('three labels at the same y get increasing offsets', () => {
    const o = spreadLabels([{ y: 100, height: 20 }, { y: 100, height: 20 }, { y: 100, height: 20 }]);
    expect(o).toEqual([0, 20, 40]);
  });
  it('separated labels get zeros', () => {
    expect(spreadLabels([{ y: 0, height: 20 }, { y: 50, height: 20 }, { y: 100, height: 20 }])).toEqual([0, 0, 0]);
  });
  it('returns offsets in input order', () => {
    expect(spreadLabels([{ y: 105, height: 20 }, { y: 100, height: 20 }])).toEqual([15, 0]);
  });
  it('handles empty input', () => {
    expect(spreadLabels([])).toEqual([]);
  });
});
