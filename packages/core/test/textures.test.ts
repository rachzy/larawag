// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanetClass } from '../src/physics/types.js';
import { planetTexture } from '../src/render/textures.js';

let fills: string[];

// jsdom has no 2D canvas: record every fill colour instead.
beforeEach(() => {
  fills = [];
  const ctx = {
    set fillStyle(v: string) {
      fills.push(v);
    },
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
});

afterEach(() => vi.restoreAllMocks());

const paint = (kind: PlanetClass, seed = 11) => {
  fills = [];
  planetTexture(kind, seed).dispose();
  return [...fills];
};

describe('planetTexture', () => {
  it('paints an ocean world blue, unlike the other classes', () => {
    const ocean = paint('ocean-world');
    expect(ocean[0]).toBe('#1f4f8a');
    expect(ocean.some((f) => f.startsWith('rgba(255,255,255,'))).toBe(true);
    for (const kind of ['rocky', 'neptune-like', 'gas-giant'] as const) expect(paint(kind)).not.toEqual(ocean);
  });

  it('is deterministic for a seed', () => {
    expect(paint('ocean-world', 5)).toEqual(paint('ocean-world', 5));
    expect(paint('ocean-world', 5)).not.toEqual(paint('ocean-world', 6));
  });

  it('keeps the rocky texture as before', () => {
    expect(paint('rocky')[0]).toBe('#8a6b4f');
  });
});
