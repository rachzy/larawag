import { Color, Mesh, MeshStandardMaterial, ShaderChunk, ShaderLib, SphereGeometry } from 'three';
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

/** r186 terms that r128 did not have, each with its r128 replacement. */
const R128_PATCHES: [string, string][] = [
  ['irradiance * specularBRDF * material.multiScatteringCompensation', 'irradiance * specularBRDF'],
  ['BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F )', 'BRDF_Lambert( material.diffuseContribution )'],
  [
    'BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering )',
    'BRDF_Lambert( material.diffuseContribution )',
  ],
];

const LIGHTS_INCLUDE = '#include <lights_physical_pars_fragment>';

/**
 * r186's physical lighting chunk with the r128 diffuse and specular terms put
 * back. Throws when a term is missing, so a three update cannot silently
 * bring back r186 shading.
 */
export function r128LightsChunk(chunk: string = ShaderChunk.lights_physical_pars_fragment): string {
  for (const [needle, replacement] of R128_PATCHES) {
    if (!chunk.includes(needle)) throw new Error(`larawag: r128 shading patch target not found: "${needle}"`);
    chunk = chunk.replace(needle, replacement);
  }
  return chunk;
}

let cachedSource: string | null = null;
let cachedChunk = '';

/** The patched chunk, computed once per lighting-chunk text; throws when the patch cannot apply. */
function patchedLightsChunk(): string {
  if (!ShaderLib.standard.fragmentShader.includes(LIGHTS_INCLUDE)) {
    throw new Error(`larawag: r128 shading patch target not found: "${LIGHTS_INCLUDE}"`);
  }
  const source = ShaderChunk.lights_physical_pars_fragment;
  if (source !== cachedSource) {
    cachedChunk = r128LightsChunk(source);
    cachedSource = source;
  }
  return cachedChunk;
}

/** Builds a textured unit-radius planet sphere. Needs a DOM canvas. Throws if the r128 shading patch cannot apply. */
export function createPlanet(p: DerivedPlanet): PlanetPiece {
  const lightsChunk = RENDER_TUNABLES.r128PlanetBrdf ? patchedLightsChunk() : null;
  const map = planetTexture(p.planetClass, p.seed);
  const material = new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  if (p.teq > 700) {
    material.emissive = new Color(0xff4a10);
    material.emissiveIntensity = planetEmissiveIntensity(p.teq);
  }
  if (lightsChunk !== null) {
    material.onBeforeCompile = (shader) => {
      if (!shader.fragmentShader.includes(LIGHTS_INCLUDE)) {
        throw new Error(`larawag: r128 shading patch target not found: "${LIGHTS_INCLUDE}"`);
      }
      shader.fragmentShader = shader.fragmentShader.replace(LIGHTS_INCLUDE, lightsChunk);
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
