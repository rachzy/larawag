import { ColorManagement, LinearSRGBColorSpace, NoColorSpace, WebGLRenderer } from 'three';

/**
 * Every colour and lighting setting that makes three r186 match the r128
 * prototype, in one place. The values are checked by `pnpm test:visual`
 * (tools/visual), not by reasoning about the settings.
 */
export const RENDER_TUNABLES = {
  /** r128 had no colour management: colours and textures were used as given. */
  colorManagement: false,
  /** r128 wrote shader output unconverted (linear output encoding). */
  outputColorSpace: LinearSRGBColorSpace,
  /** Canvas textures stay untagged, as in r128. */
  textureColorSpace: NoColorSpace,
  maxPixelRatio: 2,
  /** Prototype 1.6, times π: r128 legacy lights scaled punctual and ambient irradiance by π. */
  starLightIntensity: 1.6 * Math.PI,
  /** r128 ignored decay with distance 0, so the star light does not fall off. */
  starLightDecay: 0,
  /** Prototype 1.0, times π (see `starLightIntensity`). */
  ambientIntensity: 1.0 * Math.PI,
  /**
   * Restore r128's planet shading: r186 takes the Fresnel term out of the
   * diffuse light and adds multi-scattering to the specular, which darkens
   * the lit side of the planets by about 3-4%.
   */
  r128PlanetBrdf: true,
} as const;

/**
 * Creates the WebGL renderer and appends its canvas as the first child of
 * `parent`. Returns null when WebGL is unavailable.
 */
export function createRenderer(parent: HTMLElement): WebGLRenderer | null {
  try {
    ColorManagement.enabled = RENDER_TUNABLES.colorManagement;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = RENDER_TUNABLES.outputColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER_TUNABLES.maxPixelRatio));
    parent.insertBefore(renderer.domElement, parent.firstChild);
    return renderer;
  } catch {
    return null;
  }
}
