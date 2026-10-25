import { describe, expect, it, vi } from 'vitest';
import { RingGeometry } from 'three';
import { createHzMesh } from '../src/render/hz-mesh.js';
import { createOrbit } from '../src/render/orbits.js';
import { planetEmissiveIntensity } from '../src/render/planets.js';
import { createStarfield } from '../src/render/starfield.js';
import { rng } from '../src/render/textures.js';

describe('createOrbit', () => {
  it('has 256 points on the unit circle', () => {
    const { line, dispose } = createOrbit('#c8a27a');
    const pos = line.geometry.getAttribute('position');
    expect(pos.count).toBe(256);
    for (let i = 0; i < pos.count; i++) {
      expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeCloseTo(1, 6);
      expect(pos.getY(i)).toBe(0);
    }
    dispose();
  });

  it('disposes geometry and material', () => {
    const { line, dispose } = createOrbit('#7fb7d9');
    const g = vi.spyOn(line.geometry, 'dispose');
    const m = vi.spyOn(line.material as { dispose(): void }, 'dispose');
    dispose();
    expect(g).toHaveBeenCalledOnce();
    expect(m).toHaveBeenCalledOnce();
  });
});

describe('createHzMesh', () => {
  it('uses the given radii and 128 segments', () => {
    const { mesh, dispose } = createHzMesh(7, 12);
    const p = (mesh.geometry as RingGeometry).parameters;
    expect(p.innerRadius).toBe(7);
    expect(p.outerRadius).toBe(12);
    expect(p.thetaSegments).toBe(128);
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
    dispose();
  });

  it('disposes geometry and material', () => {
    const { mesh, dispose } = createHzMesh(1, 2);
    const g = vi.spyOn(mesh.geometry, 'dispose');
    const m = vi.spyOn(mesh.material as { dispose(): void }, 'dispose');
    dispose();
    expect(g).toHaveBeenCalledOnce();
    expect(m).toHaveBeenCalledOnce();
  });
});

describe('createStarfield', () => {
  it('is deterministic, 1800 points, on the given radius, colours in 0..1', () => {
    const a = createStarfield(100);
    const b = createStarfield(100);
    const pa = a.points.geometry.getAttribute('position');
    const pb = b.points.geometry.getAttribute('position');
    expect(pa.count).toBe(1800);
    expect(Array.from(pa.array)).toEqual(Array.from(pb.array));
    for (let i = 0; i < pa.count; i++) {
      expect(Math.hypot(pa.getX(i), pa.getY(i), pa.getZ(i))).toBeCloseTo(100, 3);
    }
    const col = a.points.geometry.getAttribute('color').array;
    expect(col.length).toBe(1800 * 3);
    expect(Array.from(col).every((v) => v >= 0 && v <= 1)).toBe(true);
    a.dispose();
    b.dispose();
  });

  it('defaults to radius 2500 and disposes', () => {
    const s = createStarfield();
    const p = s.points.geometry.getAttribute('position');
    expect(Math.hypot(p.getX(0), p.getY(0), p.getZ(0))).toBeCloseTo(2500, 2);
    const g = vi.spyOn(s.points.geometry, 'dispose');
    const m = vi.spyOn(s.points.material as { dispose(): void }, 'dispose');
    s.dispose();
    expect(g).toHaveBeenCalledOnce();
    expect(m).toHaveBeenCalledOnce();
  });
});

describe('planetEmissiveIntensity', () => {
  it('ramps above 700 K, caps at 0.25, is 0 below', () => {
    expect(planetEmissiveIntensity(915.9)).toBeCloseTo(0.0864, 4);
    expect(planetEmissiveIntensity(558.7)).toBe(0);
    expect(planetEmissiveIntensity(700)).toBe(0);
    expect(planetEmissiveIntensity(5000)).toBe(0.25);
  });
});

describe('rng', () => {
  it('is seeded and in [0,1)', () => {
    const a = rng(11);
    const b = rng(11);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
