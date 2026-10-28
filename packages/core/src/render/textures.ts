import { CanvasTexture } from 'three';
import type { PlanetClass } from '../physics/types.js';
import { rng } from '../physics/random.js';
import { RENDER_TUNABLES } from './renderer-setup.js';

export { rng };

function context2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('larawag: no 2D canvas context available for the procedural textures');
  return x;
}

/** Procedural 512x256 planet surface for a class and seed. Needs a DOM canvas. */
export function planetTexture(kind: PlanetClass, seed: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = context2d(c);
  const r = rng(seed);
  if (kind === 'rocky') {
    x.fillStyle = '#8a6b4f';
    x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 260; i++) {
      const cx = r() * 512;
      const cy = r() * 256;
      const rad = 4 + r() * 26;
      const l = r() < 0.5;
      x.fillStyle = l
        ? 'rgba(205,170,130,' + (0.08 + r() * 0.12) + ')'
        : 'rgba(40,25,18,' + (0.1 + r() * 0.18) + ')';
      x.beginPath();
      x.arc(cx, cy, rad, 0, 7);
      x.fill();
    }
  } else if (kind === 'ocean-world') {
    x.fillStyle = '#1f4f8a';
    x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 180; i++) {
      const cx = r() * 512;
      const cy = r() * 256;
      const rad = 6 + r() * 30;
      x.fillStyle = r() < 0.5
        ? 'rgba(70,130,190,' + (0.08 + r() * 0.12) + ')'
        : 'rgba(10,35,75,' + (0.1 + r() * 0.15) + ')';
      x.beginPath();
      x.arc(cx, cy, rad, 0, 7);
      x.fill();
    }
    for (let j = 0; j < 220; j++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.1 + r() * 0.25) + ')';
      x.fillRect(r() * 512, r() * 256, 20 + r() * 60, 1 + r() * 3);
    }
  } else {
    const base =
      kind === 'neptune-like'
        ? [[110, 170, 205], [88, 140, 190], [150, 200, 225]]
        : [[200, 160, 110], [170, 120, 80], [225, 195, 150]];
    let y = 0;
    while (y < 256) {
      const h = 6 + r() * 22;
      const cl = base[Math.floor(r() * base.length)]!;
      x.fillStyle = 'rgb(' + cl.join(',') + ')';
      x.fillRect(0, y, 512, h);
      y += h;
    }
    for (let j = 0; j < 400; j++) {
      x.fillStyle = 'rgba(255,255,255,' + r() * 0.05 + ')';
      x.fillRect(r() * 512, r() * 256, 30 + r() * 70, 1 + r() * 2);
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = RENDER_TUNABLES.textureColorSpace;
  return tex;
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
