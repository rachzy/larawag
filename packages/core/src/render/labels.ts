import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';

/**
 * Vertical spread: returns one y-offset per box, in input order. Boxes are
 * processed top to bottom; one overlapping the previous is pushed down.
 */
export function spreadLabels(boxes: { y: number; height: number }[]): number[] {
  const offsets = new Array<number>(boxes.length).fill(0);
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a]!.y - boxes[b]!.y);
  let bottom = -Infinity;
  for (const i of order) {
    const b = boxes[i]!;
    const off = Math.max(0, bottom - b.y);
    offsets[i] = off;
    bottom = b.y + off + b.height;
  }
  return offsets;
}

/** Projected planet labels. */
export interface Labels {
  /** `positions` are world points already raised above each planet. */
  update(positions: Vector3[], camera: PerspectiveCamera, width: number, height: number): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

/** Creates one `.larawag-label` per planet inside `wrapper`. */
export function createLabels(
  wrapper: HTMLElement,
  planets: { name: string; periodDays: number }[],
  cfg: { enabled: boolean },
): Labels {
  let enabled = cfg.enabled;
  const tmp = new Vector3();
  const els = planets.map((p) => {
    const el = document.createElement('div');
    el.className = 'larawag-label';
    el.textContent = `${p.name} · ${p.periodDays.toFixed(1)} d`;
    el.style.display = 'none';
    wrapper.appendChild(el);
    return el;
  });
  const hideAll = (): void => {
    for (const el of els) el.style.display = 'none';
  };
  return {
    update(positions, camera, width, height) {
      if (!enabled) return hideAll();
      const shown: { i: number; x: number; y: number }[] = [];
      els.forEach((el, i) => {
        const pos = positions[i];
        if (!pos) return void (el.style.display = 'none');
        tmp.copy(pos).project(camera);
        if (tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1) {
          shown.push({ i, x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height });
        } else {
          el.style.display = 'none';
        }
      });
      const offsets = spreadLabels(
        shown.map((s) => ({ y: s.y, height: els[s.i]!.offsetHeight || 20 })),
      );
      shown.forEach((s, k) => {
        const el = els[s.i]!;
        el.style.display = '';
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y + offsets[k]!}px`;
      });
    },
    setEnabled(v) {
      enabled = v;
      if (!v) hideAll();
    },
    dispose() {
      for (const el of els) el.remove();
      els.length = 0;
    },
  };
}
