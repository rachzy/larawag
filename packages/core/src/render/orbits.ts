import { BufferGeometry, Color, LineBasicMaterial, LineLoop, Vector3 } from 'three';

/** An orbit ring (unit circle in the XZ plane; scale it to the orbit radius). */
export interface OrbitPiece {
  line: LineLoop;
  dispose(): void;
}

/** Builds a 256-point unit-circle orbit line in the given CSS colour. */
export function createOrbit(colour: string): OrbitPiece {
  const pts: Vector3[] = [];
  for (let k = 0; k < 256; k++) {
    const t = (k / 256) * Math.PI * 2;
    pts.push(new Vector3(Math.cos(t), 0, Math.sin(t)));
  }
  const geometry = new BufferGeometry().setFromPoints(pts);
  const material = new LineBasicMaterial({ color: new Color(colour), transparent: true, opacity: 0.45 });
  const line = new LineLoop(geometry, material);
  return {
    line,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
