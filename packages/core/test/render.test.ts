import { describe, expect, it, vi } from 'vitest';
import { RingGeometry, ShaderChunk, ShaderLib } from 'three';
import { deriveSystem } from '../src/physics/derive.js';
import { createHzMesh } from '../src/render/hz-mesh.js';
import { createOrbit } from '../src/render/orbits.js';
import { createPlanet, planetEmissiveIntensity, r128LightsChunk } from '../src/render/planets.js';
import { fixture } from './fixture.js';
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

describe('r128LightsChunk', () => {
  const needles = [
    'irradiance * specularBRDF * material.multiScatteringCompensation',
    'BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F )',
    'BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering )',
  ];
  const original = ShaderChunk.lights_physical_pars_fragment;

  it("finds all three r186 terms in three's lighting chunk", () => {
    for (const n of needles) expect(original).toContain(n);
  });

  it('removes all three terms', () => {
    const chunk = r128LightsChunk();
    expect(chunk).not.toBe(original);
    for (const n of needles) expect(chunk).not.toContain(n);
  });

  it.each(needles)('throws naming the missing term: %s', (needle) => {
    const mutated = original.replace(needle, '/* renamed */');
    expect(() => r128LightsChunk(mutated)).toThrow(needle);
  });

  it('createPlanet throws at creation, not at render, when the lighting chunk changed', () => {
    const planet = deriveSystem(fixture).planets[0]!;
    ShaderChunk.lights_physical_pars_fragment = original.replace(needles[0]!, '/* renamed */');
    try {
      expect(() => createPlanet(planet)).toThrow(needles[0]!);
    } finally {
      ShaderChunk.lights_physical_pars_fragment = original;
    }
  });

  it('createPlanet throws at creation when the standard shader lost the lighting include', () => {
    const planet = deriveSystem(fixture).planets[0]!;
    const frag = ShaderLib.standard.fragmentShader;
    ShaderLib.standard.fragmentShader = frag.replace('#include <lights_physical_pars_fragment>', '');
    try {
      expect(() => createPlanet(planet)).toThrow('#include <lights_physical_pars_fragment>');
    } finally {
      ShaderLib.standard.fragmentShader = frag;
    }
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
