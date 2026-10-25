import { Color, Mesh, MeshStandardMaterial, ShaderChunk, SphereGeometry } from 'three';
import type { DerivedPlanet } from '../physics/derive.js';
import { RENDER_TUNABLES } from './renderer-setup.js';
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

/** r186's physical lighting chunk with the r128 diffuse and specular terms put back. */
export function r128LightsChunk(): string {
  return ShaderChunk.lights_physical_pars_fragment
    .replace('irradiance * specularBRDF * material.multiScatteringCompensation', 'irradiance * specularBRDF')
    .replace('BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F )', 'BRDF_Lambert( material.diffuseContribution )')
    .replace(
      'BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering )',
      'BRDF_Lambert( material.diffuseContribution )',
    );
}

/** Builds a textured unit-radius planet sphere. Needs a DOM canvas. */
export function createPlanet(p: DerivedPlanet): PlanetPiece {
  const map = planetTexture(p.planetClass, p.seed);
  const material = new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  if (p.teq > 700) {
    material.emissive = new Color(0xff4a10);
    material.emissiveIntensity = planetEmissiveIntensity(p.teq);
  }
  if (RENDER_TUNABLES.r128PlanetBrdf) {
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', r128LightsChunk());
    };
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
