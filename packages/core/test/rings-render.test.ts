// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DoubleSide, Texture, type Mesh, type MeshBasicMaterial } from 'three';
import { deriveSystem } from '../src/physics/derive.js';
import type { PlanetInput } from '../src/physics/types.js';
import { createPlanet } from '../src/render/planets.js';
import { createRings } from '../src/render/rings.js';
import { fixture } from './fixture.js';

vi.mock('../src/render/textures.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/render/textures.js')>();
  return {
    ...real,
    appearanceTexture: vi.fn(() => new Texture()),
    planetTexture: vi.fn(() => new Texture()),
    ringTexture: vi.fn(() => new Texture()),
  };
});

const planet = (extra: Partial<PlanetInput>) =>
  deriveSystem({ ...fixture, planets: [{ radius: 9, period: 10000, teq: 90, ...extra }] }).planets[0]!;

describe('createRings', () => {
  it('spans inner to outer planet radii, flat in the equatorial plane, with radial UVs', () => {
    const { mesh, dispose } = createRings(planet({ rings: { inner: 1.5, outer: 3 } }).rings!);
    const pos = mesh.geometry.getAttribute('position');
    const uv = mesh.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      expect(d).toBeGreaterThanOrEqual(1.5 - 1e-6);
      expect(d).toBeLessThanOrEqual(3 + 1e-6);
      expect(uv.getX(i)).toBeCloseTo((d - 1.5) / 1.5, 5);
    }
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
    dispose();
  });

  it('is see-through, double-sided and uses the ring opacity and colour', () => {
    const { mesh, dispose } = createRings(planet({ rings: { opacity: 0.4, colour: '#ff0000' } }).rings!);
    const m = mesh.material as MeshBasicMaterial;
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBe(0.4);
    expect(m.side).toBe(DoubleSide);
    expect(m.depthWrite).toBe(false);
    expect(m.color.toArray()).toEqual([1, 0, 0]);
    dispose();
  });

  it('frees geometry, material and texture', () => {
    const { mesh, dispose } = createRings(planet({ rings: true }).rings!);
    const m = mesh.material as MeshBasicMaterial;
    const spies = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(m, 'dispose'), vi.spyOn(m.map!, 'dispose')];
    dispose();
    for (const s of spies) expect(s).toHaveBeenCalledOnce();
  });
});

describe('createPlanet with rings and tilt', () => {
  it('carries its rings as a child, so they scale and tilt with it', () => {
    const piece = createPlanet(planet({ rings: true, obliquity: 26.7 }));
    expect(piece.mesh.children).toHaveLength(1);
    expect(piece.mesh.rotation.z).toBeCloseTo((26.7 * Math.PI) / 180);
    expect(piece.mesh.rotation.order).toBe('ZYX');
    const ringMat = (piece.mesh.children[0] as Mesh).material as MeshBasicMaterial;
    const freed = vi.spyOn(ringMat, 'dispose');
    piece.dispose();
    expect(freed).toHaveBeenCalledOnce();
  });

  it('has no rings and no tilt by default', () => {
    const piece = createPlanet(planet({}));
    expect(piece.mesh.children).toHaveLength(0);
    expect(piece.mesh.rotation.z).toBe(0);
    piece.dispose();
  });
});
