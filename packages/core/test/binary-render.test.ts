// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AmbientLight, PointLight, Texture } from 'three';
import { AU_PER_RSUN } from '../src/physics/constants.js';
import { deriveSystem } from '../src/physics/derive.js';
import type { SystemInput } from '../src/physics/types.js';
import { buildSystemScene, BINARY_SCENE_SEPARATION } from '../src/render/scene-assembly.js';
import { fixture } from './fixture.js';

vi.mock('../src/render/textures.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/render/textures.js')>();
  return {
    ...real,
    appearanceTexture: vi.fn(() => new Texture()),
    planetTexture: vi.fn(() => new Texture()),
    glowTexture: vi.fn(() => new Texture()),
  };
});

const input: SystemInput = {
  stars: [
    { teff: 5800, radius: 1.1, mass: 1.1 },
    { teff: 4400, radius: 0.7, mass: 0.7 },
  ],
  binary: { separation: 0.2, phase: 0.5 },
  planets: [{ period: 300, radius: 2 }],
};
const count = (root: { traverse(f: (o: unknown) => void): void }, type: new (...a: never[]) => unknown) => {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof type) n++;
  });
  return n;
};

describe('buildSystemScene with two stars', () => {
  it('draws two stars, each with its light, and one ambient light', () => {
    const scene = buildSystemScene(deriveSystem(input), 'compressed', true);
    expect(scene.stars).toHaveLength(2);
    expect(count(scene.root, PointLight)).toBe(2);
    expect(count(scene.root, AmbientLight)).toBe(1);
    scene.dispose();
  });

  it('circles the centre of mass, heavier star closer, at the binary period (compressed)', () => {
    const d = deriveSystem(input);
    const scene = buildSystemScene(d, 'compressed', true);
    const [a, b] = scene.stars;
    for (const days of [0, 10, d.binary!.periodDays / 4]) {
      scene.setTime(days);
      const th = 0.5 + (2 * Math.PI * days) / d.binary!.periodDays;
      const dA = (BINARY_SCENE_SEPARATION * 0.7) / 1.8;
      expect(a!.object.position.x).toBeCloseTo(-dA * Math.cos(th), 6);
      expect(a!.object.position.z).toBeCloseTo(-dA * Math.sin(th), 6);
      expect(b!.object.position.distanceTo(a!.object.position)).toBeCloseTo(BINARY_SCENE_SEPARATION, 6);
      expect(a!.object.position.length()).toBeLessThan(b!.object.position.length());
    }
    expect(a!.mesh.scale.x).toBeGreaterThan(b!.mesh.scale.x);
    expect(a!.mesh.scale.x + BINARY_SCENE_SEPARATION).toBeLessThan(5);
    scene.dispose();
  });

  it('uses real distances and radii in star A radii at true scale', () => {
    const d = deriveSystem(input);
    const scene = buildSystemScene(d, 'true', true);
    scene.setTime(0);
    const [a, b] = scene.stars;
    expect(b!.object.position.distanceTo(a!.object.position)).toBeCloseTo((0.2 * AU_PER_RSUN) / 1.1, 6);
    expect(a!.mesh.scale.x).toBeCloseTo(1, 6);
    expect(b!.mesh.scale.x).toBeCloseTo(0.7 / 1.1, 6);
    scene.dispose();
  });

  it('keeps a single star at the centre, as before', () => {
    const scene = buildSystemScene(deriveSystem(fixture), 'compressed', true);
    scene.setTime(42);
    expect(scene.stars).toHaveLength(1);
    expect(scene.stars[0]!.object.position.length()).toBe(0);
    expect(scene.stars[0]!.mesh.scale.x).toBe(2);
    expect(count(scene.root, AmbientLight)).toBe(1);
    scene.dispose();
  });

  it('frees both stars', () => {
    const scene = buildSystemScene(deriveSystem(input), 'compressed', true);
    const spies = scene.stars.map((s) => vi.spyOn(s, 'dispose'));
    scene.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledOnce();
  });
});
