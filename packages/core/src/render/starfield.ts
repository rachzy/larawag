import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

/** The background star points and their disposer. */
export interface StarfieldPiece {
  points: Points;
  dispose(): void;
}

const COUNT = 1800;

/** Builds the 1800-point starfield on a sphere of the given radius (prototype seed 7). */
export function createStarfield(radius = 2500): StarfieldPiece {
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < COUNT; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = radius * s * Math.cos(th);
    pos[i * 3 + 1] = radius * u;
    pos[i * 3 + 2] = radius * s * Math.sin(th);
    const b = 0.4 + 0.6 * rnd() * rnd();
    col[i * 3] = b;
    col[i * 3 + 1] = b * (0.9 + 0.1 * rnd());
    col[i * 3 + 2] = b;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('color', new BufferAttribute(col, 3));
  const material = new PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true });
  const points = new Points(geometry, material);
  return {
    points,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
