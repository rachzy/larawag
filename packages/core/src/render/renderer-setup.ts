import { ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three';

/**
 * Colour/lighting tunables for matching the r128 prototype. Kept in one place
 * so the parity pass can adjust them without touching the pieces.
 */
export const RENDER_TUNABLES = {
  colorManagement: false,
  maxPixelRatio: 2,
} as const;

/**
 * Creates the WebGL renderer and appends its canvas as the first child of
 * `parent`. Returns null when WebGL is unavailable.
 */
export function createRenderer(parent: HTMLElement): WebGLRenderer | null {
  try {
    ColorManagement.enabled = RENDER_TUNABLES.colorManagement;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER_TUNABLES.maxPixelRatio));
    parent.insertBefore(renderer.domElement, parent.firstChild);
    return renderer;
  } catch {
    return null;
  }
}
