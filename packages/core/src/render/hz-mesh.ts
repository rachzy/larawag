import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from 'three';

/** The habitable-zone ring and its disposer. */
export interface HzPiece {
  mesh: Mesh;
  dispose(): void;
}

/** Builds the translucent habitable-zone ring between two scene radii, lying in the XZ plane. */
export function createHzMesh(innerR: number, outerR: number): HzPiece {
  const geometry = new RingGeometry(innerR, outerR, 128);
  const material = new MeshBasicMaterial({
    color: 0x58c68a,
    transparent: true,
    opacity: 0.13,
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
    },
  };
}
