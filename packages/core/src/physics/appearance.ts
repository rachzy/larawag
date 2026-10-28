import { parseHexColour } from './colour.js';
import { rng } from './random.js';
import type { PlanetClass } from './types.js';

/** RGB colour, channels 0..255. */
export type Rgb = [number, number, number];

/** Three colours: for `banded` the three band colours, otherwise base, light and dark. */
export type Palette = [Rgb, Rgb, Rgb];

/** Built-in looks, one per Solar System planet. */
export const TEXTURE_PRESETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;

/** Name of a built-in look. */
export type TexturePreset = (typeof TEXTURE_PRESETS)[number];

/** Procedural pattern a planet texture is painted with. */
export type TexturePattern = 'cratered' | 'banded' | 'ocean' | 'earth' | 'cloud-deck';

/** Everything needed to paint a planet. */
export interface PlanetAppearance {
  pattern: TexturePattern;
  /** For `earth`: ocean, land, second land colour. */
  palette: Palette;
  /** Seed for the pattern. Presets have their own. */
  seed: number;
  polarCaps: boolean;
  darkSpot: boolean;
  preset: TexturePreset | null;
  /** Image to load as the texture; the procedural look shows until it loads or if it fails. */
  imageUrl: string | null;
}

/** True when `name` is one of `TEXTURE_PRESETS`. */
export function isTexturePreset(name: unknown): name is TexturePreset {
  return (TEXTURE_PRESETS as readonly unknown[]).includes(name);
}

type Regime = [upToK: number, palette: Palette];

const ROCK_TEMPERATE: Palette = [[138, 107, 79], [205, 170, 130], [40, 25, 18]];
const GIANT_CLASS_I: Palette = [[200, 160, 110], [170, 120, 80], [225, 195, 150]];

// Upper Teq bound of each regime, coolest first; the last runs to infinity.
const REGIMES: Record<PlanetClass, Regime[]> = {
  rocky: [
    [150, [[196, 206, 214], [235, 240, 245], [120, 135, 150]]],
    [500, ROCK_TEMPERATE],
    [1000, [[74, 68, 64], [120, 110, 100], [25, 22, 20]]],
    [Infinity, [[40, 30, 28], [190, 85, 30], [15, 10, 10]]],
  ],
  'neptune-like': [
    [150, [[172, 214, 222], [150, 196, 212], [196, 228, 234]]],
    [700, [[140, 160, 175], [120, 140, 158], [165, 180, 190]]],
    [Infinity, [[170, 160, 140], [150, 140, 122], [190, 180, 160]]],
  ],
  'gas-giant': [
    [150, GIANT_CLASS_I],
    [350, [[235, 235, 230], [215, 215, 210], [248, 248, 244]]],
    [900, [[90, 140, 210], [70, 120, 195], [120, 165, 225]]],
    [1400, [[50, 58, 72], [40, 46, 58], [66, 74, 90]]],
    [Infinity, [[120, 130, 110], [100, 110, 92], [145, 152, 130]]],
  ],
  'ocean-world': [
    [270, [[215, 228, 238], [245, 250, 255], [160, 185, 205]]],
    [400, [[31, 79, 138], [70, 130, 190], [10, 35, 75]]],
    [Infinity, [[200, 205, 210], [235, 238, 240], [160, 168, 175]]],
  ],
};

const PATTERNS: Record<PlanetClass, TexturePattern> = {
  rocky: 'cratered',
  'neptune-like': 'banded',
  'gas-giant': 'banded',
  'ocean-world': 'ocean',
};

type PresetLook = Omit<PlanetAppearance, 'preset' | 'imageUrl'>;

const look = (pattern: TexturePattern, palette: Palette, seed: number, polarCaps = false, darkSpot = false): PresetLook => ({
  pattern,
  palette,
  seed,
  polarCaps,
  darkSpot,
});

// Approximate true colours. Neptune follows the 2024 reprocessing (Irwin et al. 2024): pale, close to Uranus.
const PRESETS: Record<TexturePreset, PresetLook> = {
  mercury: look('cratered', [[140, 134, 128], [175, 170, 165], [70, 66, 62]], 7),
  venus: look('cloud-deck', [[230, 213, 168], [245, 235, 205], [205, 185, 140]], 3),
  earth: look('earth', [[28, 70, 130], [96, 120, 70], [150, 130, 95]], 5, true),
  mars: look('cratered', [[181, 83, 44], [210, 130, 90], [90, 40, 25]], 9, true),
  jupiter: look('banded', GIANT_CLASS_I, 31),
  saturn: look('banded', [[216, 192, 140], [200, 176, 128], [230, 212, 170]], 13),
  uranus: look('banded', [[172, 218, 222], [165, 212, 218], [182, 224, 228]], 17),
  neptune: look('banded', [[140, 180, 214], [128, 168, 206], [158, 194, 224]], 19, false, true),
};

const BLEND_K = 50;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;
const mixPalette = (a: Palette, b: Palette, t: number): Palette => [0, 1, 2].map((i) => mix(a[i]!, b[i]!, t)) as Palette;

/**
 * Palette for a class at an equilibrium temperature, before seeded variation. Regimes:
 * rocky icy / bare rock / dark basalt / lava (150, 500, 1000 K); Neptune-like cyan / grey-blue
 * haze / grey-tan haze (150, 700 K); gas giants by Sudarsky class (150, 350, 900, 1400 K);
 * ocean worlds ice / water / steam (270, 400 K). Neighbouring regimes blend over 50 K.
 */
export function inferredPalette(planetClass: PlanetClass, teq: number): Palette {
  const regimes = REGIMES[planetClass];
  for (let i = 0; i < regimes.length - 1; i++) {
    const edge = regimes[i]![0];
    if (teq < edge - BLEND_K / 2) return regimes[i]![1];
    if (teq <= edge + BLEND_K / 2) {
      return mixPalette(regimes[i]![1], regimes[i + 1]![1], (teq - (edge - BLEND_K / 2)) / BLEND_K);
    }
  }
  return regimes[regimes.length - 1]![1];
}

/** Hue in degrees, saturation and lightness 0..1. */
export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d + 6) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const MAX_HUE_SHIFT = 8;
const MAX_LIGHTNESS_SHIFT = 0.08;

/**
 * Shifts every colour of a palette by the same seeded hue (within ±8°) and lightness
 * (within ±0.08), never raising saturation, so no unreal colours appear.
 */
export function varyPalette(palette: Palette, seed: number): Palette {
  const r = rng(seed ^ 0x5bd1e995);
  const dh = (r() * 2 - 1) * MAX_HUE_SHIFT;
  const dl = (r() * 2 - 1) * MAX_LIGHTNESS_SHIFT;
  return palette.map((c) => {
    const [h, s, l] = rgbToHsl(c);
    return hslToRgb(h + dh, s, Math.min(1, Math.max(0, l + dl))).map((v) => Math.min(255, Math.max(0, v))) as Rgb;
  }) as Palette;
}

function paletteFromColour(hex: string, pattern: TexturePattern, base: Palette): Palette {
  const c = parseHexColour(hex)!.map((v) => v * 255) as Rgb;
  if (pattern === 'earth') return [c, base[1], base[2]];
  if (pattern === 'banded') return [c, mix(c, [0, 0, 0], 0.15), mix(c, [255, 255, 255], 0.2)];
  return [c, mix(c, [255, 255, 255], 0.35), mix(c, [0, 0, 0], 0.6)];
}

/** Inputs that decide a planet's look. */
export interface AppearanceInput {
  planetClass: PlanetClass;
  teq: number;
  seed: number;
  /** A preset name or an image URL. */
  texture?: string;
  /** `#rgb` or `#rrggbb`; replaces the palette and keeps the pattern. */
  colour?: string;
}

/**
 * A planet's look: a preset when `texture` names one, else a pattern from the class and a
 * palette from the class and Teq with seeded variation. `colour` replaces the palette as given.
 */
export function planetAppearance(input: AppearanceInput): PlanetAppearance {
  const preset = isTexturePreset(input.texture) ? input.texture : null;
  const imageUrl = input.texture !== undefined && !preset ? input.texture : null;
  const base: PresetLook = preset
    ? PRESETS[preset]
    : look(PATTERNS[input.planetClass], varyPalette(inferredPalette(input.planetClass, input.teq), input.seed), input.seed);
  const palette = input.colour === undefined ? base.palette : paletteFromColour(input.colour, base.pattern, base.palette);
  return { ...base, palette, preset, imageUrl };
}
