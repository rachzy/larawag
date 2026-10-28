// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planetAppearance, TEXTURE_PRESETS, type PlanetAppearance } from '../src/physics/appearance.js';
import type { PlanetClass } from '../src/physics/types.js';
import { ringDefaults } from '../src/physics/rings.js';
import { appearanceTexture, planetTexture, ringTexture } from '../src/render/textures.js';

let ops: string[];

// jsdom has no 2D canvas: record every drawing call instead.
beforeEach(() => {
  const ctx = {
    set fillStyle(v: string) {
      ops.push(`fill ${v}`);
    },
    fillRect: (...a: number[]) => ops.push(`rect ${a.join(' ')}`),
    beginPath: () => {},
    arc: (...a: number[]) => ops.push(`arc ${a.join(' ')}`),
    fill: () => {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
});

afterEach(() => vi.restoreAllMocks());

const record = (paint: () => { dispose(): void }) => {
  ops = [];
  paint().dispose();
  return ops;
};
const paint = (kind: PlanetClass, seed = 11) => record(() => planetTexture(kind, seed));
const fills = (o: string[]) => o.filter((s) => s.startsWith('fill '));
const look = (texture: string) => planetAppearance({ planetClass: 'rocky', teq: 300, seed: 1, texture });

describe('planetTexture (prototype style)', () => {
  it('paints an ocean world blue, unlike the other classes', () => {
    const ocean = paint('ocean-world');
    expect(ocean[0]).toBe('fill rgb(31,79,138)');
    expect(ocean.some((f) => f.startsWith('fill rgba(255,255,255,'))).toBe(true);
    for (const kind of ['rocky', 'neptune-like', 'gas-giant'] as const) expect(paint(kind)).not.toEqual(ocean);
  });

  it('is deterministic for a seed', () => {
    expect(paint('ocean-world', 5)).toEqual(paint('ocean-world', 5));
    expect(paint('ocean-world', 5)).not.toEqual(paint('ocean-world', 6));
  });

  it("keeps the prototype's rocky colours", () => {
    const o = fills(paint('rocky'));
    expect(o[0]).toBe('fill rgb(138,107,79)');
    expect(o.slice(1).every((f) => f.startsWith('fill rgba(205,170,130,') || f.startsWith('fill rgba(40,25,18,'))).toBe(true);
  });
});

describe('appearanceTexture', () => {
  it("paints the jupiter preset exactly like the prototype's gas giant with seed 31", () => {
    expect(record(() => appearanceTexture(look('jupiter')))).toEqual(paint('gas-giant', 31));
  });

  it('paints every preset without error, each differently', () => {
    const all = TEXTURE_PRESETS.map((t) => record(() => appearanceTexture(look(t))).join('|'));
    expect(new Set(all).size).toBe(TEXTURE_PRESETS.length);
  });

  it('adds polar caps to Mars and Earth, and a dark spot to Neptune', () => {
    const caps = 'fill rgba(240,244,248,0.9)';
    expect(record(() => appearanceTexture(look('mars')))).toContain(caps);
    expect(record(() => appearanceTexture(look('earth')))).toContain(caps);
    expect(record(() => appearanceTexture(look('mercury')))).not.toContain(caps);
    expect(record(() => appearanceTexture(look('neptune')))).toContain('fill rgba(30,45,90,0.55)');
  });

  it('paints with the given colour', () => {
    const a: PlanetAppearance = planetAppearance({ planetClass: 'rocky', teq: 300, seed: 2, colour: '#ff0000' });
    expect(record(() => appearanceTexture(a))[0]).toBe('fill rgb(255,0,0)');
  });
});

describe('ringTexture', () => {
  const rings = (inner: number, outer: number, seed = 3) => ({ ...ringDefaults(90), inner, outer, seed });
  const alphas = (o: string[]) => fills(o).map((f) => Number(f.slice(f.lastIndexOf(',') + 1, -1)));

  it('paints one white column per step from inner to outer edge; the material adds the colour', () => {
    const o = record(() => ringTexture(rings(1.2, 2.3)));
    expect(fills(o)).toHaveLength(256);
    expect(fills(o).every((f) => f.startsWith('fill rgba(255,255,255,'))).toBe(true);
  });

  it('leaves a Cassini-like gap between 1.95 and 2.02 planet radii', () => {
    const a = alphas(record(() => ringTexture(rings(1.2, 2.3))));
    const col = (r: number) => Math.floor(((r - 1.2) / 1.1) * 256);
    expect(a[col(1.985)]).toBeLessThan(0.1);
    expect(a[col(1.6)]).toBeGreaterThan(0.3);
  });

  it('has no gap when the rings do not reach it', () => {
    expect(Math.min(...alphas(record(() => ringTexture(rings(1.2, 1.8)))))).toBeGreaterThan(0.3);
  });

  it('is deterministic per seed', () => {
    expect(record(() => ringTexture(rings(1.2, 2.3, 4)))).toEqual(record(() => ringTexture(rings(1.2, 2.3, 4))));
    expect(record(() => ringTexture(rings(1.2, 2.3, 4)))).not.toEqual(record(() => ringTexture(rings(1.2, 2.3, 5))));
  });
});
