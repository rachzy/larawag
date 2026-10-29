import { CanvasTexture } from 'three';
import type { PlanetAppearance, Rgb, TexturePattern } from '../physics/appearance.js';
import type { PlanetClass } from '../physics/types.js';
import { rng } from '../physics/random.js';
import { RENDER_TUNABLES } from './renderer-setup.js';

export { rng };

function context2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('larawag: no 2D canvas context available for the procedural textures');
  return x;
}

type Ctx = CanvasRenderingContext2D;

const W = 512;
const H = 256;

const rgb = (c: Rgb): string => 'rgb(' + c.map(Math.round).join(',') + ')';
const rgba = (c: Rgb, a: number): string => 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';

function blotches(x: Ctx, r: () => number, n: number, minRad: number, spread: number, light: Rgb, dark: Rgb, la: [number, number], da: [number, number]): void {
  for (let i = 0; i < n; i++) {
    const cx = r() * W;
    const cy = r() * H;
    const rad = minRad + r() * spread;
    x.fillStyle = r() < 0.5 ? rgba(light, la[0] + r() * la[1]) : rgba(dark, da[0] + r() * da[1]);
    x.beginPath();
    x.arc(cx, cy, rad, 0, 7);
    x.fill();
  }
}

function streaks(x: Ctx, r: () => number, n: number, alpha: (r: () => number) => number, minW: number, spreadW: number, minH: number, spreadH: number): void {
  for (let j = 0; j < n; j++) {
    x.fillStyle = 'rgba(255,255,255,' + alpha(r) + ')';
    x.fillRect(r() * W, r() * H, minW + r() * spreadW, minH + r() * spreadH);
  }
}

function polarCaps(x: Ctx): void {
  x.fillStyle = 'rgba(240,244,248,0.9)';
  x.fillRect(0, 0, W, 14);
  x.fillRect(0, H - 14, W, 14);
}

const PAINTERS: Record<TexturePattern, (x: Ctx, r: () => number, a: PlanetAppearance) => void> = {
  cratered(x, r, { palette: [base, light, dark], polarCaps: caps }) {
    x.fillStyle = rgb(base);
    x.fillRect(0, 0, W, H);
    blotches(x, r, 260, 4, 26, light, dark, [0.08, 0.12], [0.1, 0.18]);
    if (caps) polarCaps(x);
  },
  banded(x, r, { palette, darkSpot }) {
    let y = 0;
    while (y < H) {
      const h = 6 + r() * 22;
      x.fillStyle = rgb(palette[Math.floor(r() * palette.length)]!);
      x.fillRect(0, y, W, h);
      y += h;
    }
    streaks(x, r, 400, (r) => r() * 0.05, 30, 70, 1, 2);
    if (darkSpot) {
      x.fillStyle = 'rgba(30,45,90,0.55)';
      x.beginPath();
      x.arc(r() * W, H * 0.62, 12, 0, 7);
      x.fill();
    }
  },
  ocean(x, r, { palette: [base, light, dark] }) {
    x.fillStyle = rgb(base);
    x.fillRect(0, 0, W, H);
    blotches(x, r, 180, 6, 30, light, dark, [0.08, 0.12], [0.1, 0.15]);
    streaks(x, r, 220, (r) => 0.1 + r() * 0.25, 20, 60, 1, 3);
  },
  earth(x, r, { palette: [sea, land, land2] }) {
    x.fillStyle = rgb(sea);
    x.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      const kx = r() * W;
      const ky = 40 + r() * (H - 80);
      for (let i = 0; i < 30; i++) {
        x.fillStyle = rgba(r() < 0.6 ? land : land2, 0.7 + r() * 0.3);
        x.beginPath();
        x.arc(kx + (r() - 0.5) * 90, ky + (r() - 0.5) * 50, 5 + r() * 16, 0, 7);
        x.fill();
      }
    }
    polarCaps(x);
    streaks(x, r, 180, (r) => 0.15 + r() * 0.3, 20, 70, 1, 4);
  },
  'cloud-deck'(x, r, { palette: [base, light, dark] }) {
    x.fillStyle = rgb(base);
    x.fillRect(0, 0, W, H);
    for (let j = 0; j < 300; j++) {
      x.fillStyle = r() < 0.5 ? rgba(light, 0.06 + r() * 0.1) : rgba(dark, 0.06 + r() * 0.1);
      x.fillRect(r() * W, r() * H, 80 + r() * 160, 2 + r() * 6);
    }
  },
};

function canvasTexture(paint: (x: Ctx) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  paint(context2d(c));
  const tex = new CanvasTexture(c);
  tex.colorSpace = RENDER_TUNABLES.textureColorSpace;
  return tex;
}

/** Procedural 512x256 planet surface for an appearance. Needs a DOM canvas. */
export function appearanceTexture(a: PlanetAppearance): CanvasTexture {
  return canvasTexture((x) => PAINTERS[a.pattern](x, rng(a.seed), a));
}

const PROTOTYPE: Record<PlanetClass, Pick<PlanetAppearance, 'pattern' | 'palette'>> = {
  rocky: { pattern: 'cratered', palette: [[138, 107, 79], [205, 170, 130], [40, 25, 18]] },
  'neptune-like': { pattern: 'banded', palette: [[110, 170, 205], [88, 140, 190], [150, 200, 225]] },
  'gas-giant': { pattern: 'banded', palette: [[200, 160, 110], [170, 120, 80], [225, 195, 150]] },
  'ocean-world': { pattern: 'ocean', palette: [[31, 79, 138], [70, 130, 190], [10, 35, 75]] },
};

/** The prototype's procedural surface for a class and seed (the `'prototype'` planet style). Needs a DOM canvas. */
export function planetTexture(kind: PlanetClass, seed: number): CanvasTexture {
  return appearanceTexture({ ...PROTOTYPE[kind], seed, polarCaps: false, darkSpot: false, preset: null, imageUrl: null, inferred: true });
}

/** The white radial-gradient glow sprite texture. Needs a DOM canvas. */
export function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = context2d(c);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = RENDER_TUNABLES.textureColorSpace;
  return tex;
}
