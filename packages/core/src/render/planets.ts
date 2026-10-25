import { Color, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { DerivedPlanet } from '../physics/derive.js';
import { planetTexture } from './textures.js';

/** A planet sphere and its disposer. */
export interface PlanetPiece {
  mesh: Mesh;
  dispose(): void;
}

/** Emissive glow for hot planets: 0 up to 700 K, then ramps, capped at 0.25. */
export function planetEmissiveIntensity(teq: number): number {
  return teq > 700 ? Math.min(0.25, (teq - 700) / 2500) : 0;
}

/** Builds a textured unit-radius planet sphere. Needs a DOM canvas. */
export function createPlanet(p: DerivedPlanet): PlanetPiece {
  const map = planetTexture(p.planetClass, p.seed);
  const material = new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  if (p.teq > 700) {
    material.emissive = new Color(0xff4a10);
    material.emissiveIntensity = planetEmissiveIntensity(p.teq);
  }
  const geometry = new SphereGeometry(1, 40, 28);
  const mesh = new Mesh(geometry, material);
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
