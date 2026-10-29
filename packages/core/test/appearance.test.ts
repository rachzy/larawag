import { describe, expect, it } from 'vitest';
import {
  deriveSystem,
  inferredPalette,
  isTexturePreset,
  planetAppearance,
  rgbToHsl,
  varyPalette,
  type Rgb,
} from '../src/physics.js';
import { fixture } from './fixture.js';

const near = (a: Rgb, b: Rgb, digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));

describe('inferredPalette', () => {
  it('gives temperate rocky planets the prototype rock colours', () => {
    expect(inferredPalette('rocky', 300)).toEqual([[138, 107, 79], [205, 170, 130], [40, 25, 18]]);
  });

  it('gives cold gas giants the prototype (Sudarsky class I) bands', () => {
    expect(inferredPalette('gas-giant', 110)).toEqual([[200, 160, 110], [170, 120, 80], [225, 195, 150]]);
  });

  it('follows the Sudarsky classes for gas giants', () => {
    const blue = inferredPalette('gas-giant', 600)[0];
    expect(blue[2]).toBeGreaterThan(blue[0]);
    const white = inferredPalette('gas-giant', 250)[0];
    expect(Math.min(...white)).toBeGreaterThan(200);
    const dark = inferredPalette('gas-giant', 1100)[0];
    expect(Math.max(...dark)).toBeLessThan(90);
  });

  it('turns rocky planets icy when cold and dark when lava-hot', () => {
    expect(Math.min(...inferredPalette('rocky', 100)[0])).toBeGreaterThan(180);
    expect(Math.max(...inferredPalette('rocky', 1500)[0])).toBeLessThan(60);
  });

  it('gives cold Neptune-like planets a pale cyan', () => {
    const [r, g, b] = inferredPalette('neptune-like', 70)[0];
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
  });

  it('gives ocean worlds ice, liquid water or steam', () => {
    expect(inferredPalette('ocean-world', 330)[0]).toEqual([31, 79, 138]);
    expect(Math.min(...inferredPalette('ocean-world', 200)[0])).toBeGreaterThan(200);
    expect(Math.min(...inferredPalette('ocean-world', 500)[0])).toBeGreaterThan(190);
  });

  it('blends over 50 K across a boundary, with no jump', () => {
    const mid = inferredPalette('gas-giant', 150)[0];
    const lo = inferredPalette('gas-giant', 125)[0];
    const hi = inferredPalette('gas-giant', 175)[0];
    near(mid, [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]);
    near(inferredPalette('gas-giant', 124)[0], lo);
  });
});

describe('varyPalette', () => {
  it('is deterministic per seed', () => {
    const p = inferredPalette('gas-giant', 110);
    expect(varyPalette(p, 4)).toEqual(varyPalette(p, 4));
    expect(varyPalette(p, 4)).not.toEqual(varyPalette(p, 5));
  });

  it('stays within ±8° hue and ±0.08 lightness, saturation unchanged', () => {
    const p = inferredPalette('rocky', 300);
    for (let seed = 1; seed < 200; seed++) {
      varyPalette(p, seed).forEach((c, i) => {
        const [h0, s0, l0] = rgbToHsl(p[i]!);
        const [h1, s1, l1] = rgbToHsl(c);
        const dh = Math.abs(((h1 - h0 + 540) % 360) - 180);
        expect(dh).toBeLessThanOrEqual(8.01);
        expect(Math.abs(l1 - l0)).toBeLessThanOrEqual(0.0801);
        expect(s1).toBeLessThanOrEqual(s0 + 1e-6);
        for (const ch of c) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      });
    }
  });
});

describe('planetAppearance', () => {
  it('infers pattern and palette from class and temperature', () => {
    const a = planetAppearance({ planetClass: 'gas-giant', teq: 110, seed: 11 });
    expect(a).toMatchObject({ pattern: 'banded', seed: 11, preset: null, imageUrl: null, inferred: true });
    expect(a.palette).toEqual(varyPalette(inferredPalette('gas-giant', 110), 11));
  });

  it('uses the jupiter preset as the prototype gas giant with seed 31, whatever the planet', () => {
    const a = planetAppearance({ planetClass: 'rocky', teq: 900, seed: 3, texture: 'jupiter' });
    expect(a).toMatchObject({ pattern: 'banded', seed: 31, preset: 'jupiter', polarCaps: false, inferred: false });
    expect(a.palette).toEqual([[200, 160, 110], [170, 120, 80], [225, 195, 150]]);
  });

  it('has a preset for every Solar System planet', () => {
    for (const name of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      expect(isTexturePreset(name)).toBe(true);
      expect(planetAppearance({ planetClass: 'rocky', teq: 300, seed: 1, texture: name }).preset).toBe(name);
    }
    expect(isTexturePreset('pluto')).toBe(false);
  });

  it('gives Mars polar caps and Neptune a dark spot', () => {
    expect(planetAppearance({ planetClass: 'rocky', teq: 210, seed: 1, texture: 'mars' }).polarCaps).toBe(true);
    expect(planetAppearance({ planetClass: 'neptune-like', teq: 50, seed: 1, texture: 'neptune' }).darkSpot).toBe(true);
  });

  it('replaces the palette with a given colour, unvaried, keeping the pattern', () => {
    const a = planetAppearance({ planetClass: 'rocky', teq: 300, seed: 9, colour: '#ff0000' });
    expect(a.pattern).toBe('cratered');
    expect(a.palette[0]).toEqual([255, 0, 0]);
    expect(a.inferred).toBe(false);
    const j = planetAppearance({ planetClass: 'rocky', teq: 300, seed: 9, texture: 'jupiter', colour: '#336699' });
    expect(j.pattern).toBe('banded');
    expect(j.seed).toBe(31);
    expect(j.palette[0]).toEqual([0x33, 0x66, 0x99]);
  });

  it('keeps an image URL and an inferred fallback', () => {
    const a = planetAppearance({ planetClass: 'gas-giant', teq: 110, seed: 11, texture: 'https://example.com/map.jpg' });
    expect(a.imageUrl).toBe('https://example.com/map.jpg');
    expect(a.pattern).toBe('banded');
    expect(a.preset).toBeNull();
  });
});

describe('deriveSystem appearance', () => {
  it('derives an appearance per planet from teq and class', () => {
    const [b, c] = deriveSystem(fixture).planets;
    expect(b!.appearance.pattern).toBe('cratered');
    expect(c!.appearance.pattern).toBe('banded');
    expect(b!.appearance.palette).toEqual(varyPalette(inferredPalette('rocky', b!.teq), 11));
  });

  it('uses a teq override for the look', () => {
    const d = deriveSystem({ ...fixture, planets: [{ radius: 11, period: 4000, teq: 600 }] });
    expect(d.planets[0]!.appearance.palette).toEqual(varyPalette(inferredPalette('gas-giant', 600), 11));
  });
});
