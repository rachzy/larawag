/** Approximate blackbody colour for a temperature in K, softened toward white. Channels in 0..1. */
export function blackbodyColour(teff: number): [number, number, number] {
  const t = teff / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => (Math.max(0, Math.min(255, v)) / 255) * 0.8 + 0.2;
  return [c(r), c(g), c(b)];
}

/** Format a 0..1 RGB triple as a CSS `rgb(R,G,B)` string. */
export function colourToCss(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb.map((x) => Math.round(x * 255)).join(',')})`;
}
