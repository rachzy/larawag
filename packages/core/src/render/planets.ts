import { Color, Mesh, MeshStandardMaterial, ShaderChunk, ShaderLib, SphereGeometry, TextureLoader, type Texture } from 'three';
import type { DerivedPlanet } from '../physics/derive.js';
import { RENDER_TUNABLES } from './renderer-setup.js';
import { createRings } from './rings.js';
import { appearanceTexture, planetTexture } from './textures.js';

/** `'inferred'` paints guessed looks from class and temperature; `'prototype'` keeps the v1 prototype's textures for them. */
export type PlanetStyle = 'inferred' | 'prototype';

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

/**
 * Builds a textured unit-radius planet sphere. An image texture replaces the procedural one
 * once it loads; on error the procedural one stays. Needs a DOM canvas. Throws if the r128
 * shading patch cannot apply.
 */
export function createPlanet(p: DerivedPlanet, style: PlanetStyle = 'inferred'): PlanetPiece {
  const lightsChunk = RENDER_TUNABLES.r128PlanetBrdf ? patchedLightsChunk() : null;
  const a = p.appearance;
  let map: Texture = style === 'prototype' && a.inferred ? planetTexture(p.planetClass, p.seed) : appearanceTexture(a);
  let disposed = false;
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
  if (a.imageUrl !== null) {
    new TextureLoader().setCrossOrigin('anonymous').load(a.imageUrl, (image) => {
      if (disposed) {
        image.dispose();
        return;
      }
      image.colorSpace = RENDER_TUNABLES.textureColorSpace;
      map.dispose();
      map = material.map = image;
      material.needsUpdate = true;
    });
  }
  const geometry = new SphereGeometry(1, 40, 28);
  const mesh = new Mesh(geometry, material);
  // Tilt last, so the spin about y turns around the tilted axis.
  mesh.rotation.order = 'ZYX';
  mesh.rotation.z = (p.obliquity * Math.PI) / 180;
  const rings = p.rings ? createRings(p.rings) : null;
  if (rings) mesh.add(rings.mesh);
  return {
    mesh,
    dispose() {
      disposed = true;
      rings?.dispose();
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
