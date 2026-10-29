/** Share of the view height the followed planet (with its rings) fills. */
const FOLLOW_FILL = 0.3;
/** Click tolerance in pixels around planets drawn smaller than this. */
const PICK_TOLERANCE = 12;

/**
 * Index of the planet under a click at (`x`, `y`) pixels, or null. `points` are
 * projected centres with on-screen radius `r`; null entries are not visible.
 */
export function pickPlanet(points: ({ x: number; y: number; r: number } | null)[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  points.forEach((p, i) => {
    if (!p) return;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > Math.max(p.r, PICK_TOLERANCE)) return;
    const gap = d - p.r;
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/** Camera distance at which a body of radius `extent` fills a fixed share of the view height. */
export function followDistance(extent: number, fovDeg: number): number {
  return extent / (FOLLOW_FILL * Math.tan((fovDeg * Math.PI) / 360));
}

/** Smoothstep easing on [0, 1], clamped. */
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
