import { Color, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import type { DerivedRings } from '../physics/rings.js';
import { ringTexture } from './textures.js';

/** A ring mesh in its planet's equatorial plane, radii in planet radii, and its disposer. */
export interface RingsPiece {
  mesh: Mesh;
  dispose(): void;
}

/** Builds a planet's rings, unlit so both faces show, to be added as a child of the planet mesh. Needs a DOM canvas. */
export function createRings(r: DerivedRings): RingsPiece {
  const geometry = new RingGeometry(r.inner, r.outer, 128, 1);
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - r.inner) / (r.outer - r.inner), 0.5);
  }
  const map = ringTexture(r);
  const material = new MeshBasicMaterial({
    map,
    color: new Color(r.colour[0] / 255, r.colour[1] / 255, r.colour[2] / 255),
    transparent: true,
    opacity: r.opacity,
    side: DoubleSide,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
