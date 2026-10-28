import {
  AdditiveBlending,
  AmbientLight,
  Color,
  Group,
  Mesh,
  PointLight,
  Sprite,
  SphereGeometry,
  ShaderMaterial,
  SpriteMaterial,
} from 'three';
import { RENDER_TUNABLES } from './renderer-setup.js';
import { glowTexture } from './textures.js';

/** The star mesh, its glow sprite and the scene lights. */
export interface StarPiece {
  /** Group holding mesh, glow, light and ambient. */
  object: Group;
  mesh: Mesh;
  glow: Sprite;
  light: PointLight;
  ambient: AmbientLight;
  dispose(): void;
}

const VERTEX =
  'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vP=mv.xyz;gl_Position=projectionMatrix*mv;}';
const FRAGMENT =
  'uniform vec3 color;varying vec3 vN;varying vec3 vP;void main(){float mu=clamp(dot(normalize(vN),normalize(-vP)),0.0,1.0);float I=1.0-0.65*(1.0-mu);gl_FragColor=vec4(color*I*1.25,1.0);}';

/** Builds the limb-darkened star with glow and lighting. `colour` is linear RGB 0..1. */
export function createStar(colour: [number, number, number]): StarPiece {
  const starCol = new Color(colour[0], colour[1], colour[2]);
  const material = new ShaderMaterial({
    uniforms: { color: { value: starCol } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const geometry = new SphereGeometry(1, 48, 32);
  const mesh = new Mesh(geometry, material);

  const map = glowTexture();
  const glowMaterial = new SpriteMaterial({
    map,
    color: starCol,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const glow = new Sprite(glowMaterial);

  const light = new PointLight(starCol, RENDER_TUNABLES.starLightIntensity, 0, RENDER_TUNABLES.starLightDecay);
  const ambient = new AmbientLight(0x1a2038, RENDER_TUNABLES.ambientIntensity);

  const object = new Group();
  object.add(mesh, glow, light, ambient);
  return {
    object,
    mesh,
    glow,
    light,
    ambient,
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
      glowMaterial.dispose();
      // three shares one geometry between all sprites; this frees its GPU buffers (re-uploaded on next use).
      glow.geometry.dispose();
    },
  };
}
