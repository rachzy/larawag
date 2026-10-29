// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Texture, type MeshStandardMaterial } from 'three';
import { deriveSystem } from '../src/physics/derive.js';
import { createPlanet } from '../src/render/planets.js';
import { fixture } from './fixture.js';

const loads: { url: string; onLoad: (t: Texture) => void; onError?: (e: unknown) => void }[] = [];

vi.mock('three', async (importOriginal) => {
  const real = await importOriginal<typeof import('three')>();
  class FakeLoader {
    setCrossOrigin() {
      return this;
    }
    load(url: string, onLoad: (t: Texture) => void, _p?: unknown, onError?: (e: unknown) => void) {
      loads.push({ url, onLoad, onError });
      return new real.Texture();
    }
  }
  return { ...real, TextureLoader: FakeLoader };
});

vi.mock('../src/render/textures.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/render/textures.js')>();
  return { ...real, appearanceTexture: vi.fn(() => new Texture()), planetTexture: vi.fn(() => new Texture()) };
});

const URL_ = 'https://example.com/map.jpg';
const planet = () =>
  deriveSystem({ ...fixture, planets: [{ ...fixture.planets[0]!, texture: URL_ }] }).planets[0]!;

beforeEach(() => {
  loads.length = 0;
});

describe('image textures', () => {
  it('shows the procedural texture until the image loads, then swaps and frees it', () => {
    const piece = createPlanet(planet());
    const material = piece.mesh.material as MeshStandardMaterial;
    const procedural = material.map!;
    const freed = vi.spyOn(procedural, 'dispose');
    expect(loads.map((l) => l.url)).toEqual([URL_]);
    const image = new Texture();
    loads[0]!.onLoad(image);
    expect(material.map).toBe(image);
    expect(freed).toHaveBeenCalledOnce();
    const imageFreed = vi.spyOn(image, 'dispose');
    piece.dispose();
    expect(imageFreed).toHaveBeenCalledOnce();
  });

  it('keeps the procedural texture when the image fails', () => {
    const piece = createPlanet(planet());
    const material = piece.mesh.material as MeshStandardMaterial;
    const procedural = material.map;
    expect(() => loads[0]!.onError?.(new Event('error'))).not.toThrow();
    expect(material.map).toBe(procedural);
    piece.dispose();
  });

  it('frees an image that arrives after dispose and never attaches it', () => {
    const piece = createPlanet(planet());
    const material = piece.mesh.material as MeshStandardMaterial;
    const procedural = material.map;
    piece.dispose();
    const late = new Texture();
    const lateFreed = vi.spyOn(late, 'dispose');
    loads[0]!.onLoad(late);
    expect(lateFreed).toHaveBeenCalledOnce();
    expect(material.map).toBe(procedural);
  });

  it('loads nothing without an image URL', () => {
    createPlanet(deriveSystem(fixture).planets[0]!).dispose();
    expect(loads).toHaveLength(0);
  });
});
