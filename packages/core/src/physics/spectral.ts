import { DWARF_TABLE } from './spectral-table.js';

/** Harvard spectral class letter, hottest (O) to coolest (Y). */
export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'L' | 'T' | 'Y';

/** A parsed spectral type such as `G2V`. */
export interface ParsedSpectralType {
  spectralClass: SpectralClass;
  /** 0 to 9.5; 5 when the type gives none. */
  subclass: number;
  /** First Yerkes class given (`'V'`, `'III'`, `'Iab'`…), or null. */
  luminosityClass: string | null;
  /** True when no luminosity class is given, or it is (or includes) V or VI. */
  dwarf: boolean;
}

/** Values looked up from the main-sequence table. A field is missing when the table has no value there. */
export interface SpectralProperties {
  teff: number;
  radius?: number;
  mass?: number;
}

const CLASSES = 'OBAFGKMLTY';
const LUM = '(Iab|Ia|Ib|III|II|IV|VI|V)';
const PATTERN = new RegExp(`^\\s*([${CLASSES}])(\\d(?:\\.\\d+)?)?\\s*(?:${LUM}(?:\\s*[-/]\\s*${LUM})?)?[a-z:]*\\s*$`);

const isDwarfClass = (c: string | undefined) => c === 'V' || c === 'VI';

/**
 * Parses a spectral type as catalogues write it (`"G2V"`, `"K1.5 III"`, `"M4.5Ve"`, `"F9IV-V"`).
 * Peculiarity suffixes are ignored. Returns null when the text is not a spectral type.
 */
export function parseSpectralType(text: string): ParsedSpectralType | null {
  const m = PATTERN.exec(text);
  if (!m) return null;
  const [, letter, sub, lum, lum2] = m;
  return {
    spectralClass: letter as SpectralClass,
    subclass: sub === undefined ? 5 : Number(sub),
    luminosityClass: lum ?? null,
    dwarf: lum === undefined || isDwarfClass(lum) || isDwarfClass(lum2),
  };
}

const position = (letter: string, subclass: number) => CLASSES.indexOf(letter) * 10 + subclass;

/**
 * Teff, radius and mass of a main-sequence star of this type, interpolated in the
 * Pecaut & Mamajek (2013) table (O3V to Y4V). Giants get the dwarf values too.
 * Returns null outside the table.
 */
export function spectralProperties(parsed: ParsedSpectralType): SpectralProperties | null {
  const x = position(parsed.spectralClass, parsed.subclass);
  const rows = DWARF_TABLE.map(([c, s, teff, radius, mass]) => ({ at: position(c, s), values: [teff, radius, mass] }));
  const hi = rows.findIndex((r) => r.at >= x);
  if (hi < 0 || (hi === 0 && rows[0]!.at > x)) return null;
  const upper = rows[hi]!;
  const lower = upper.at === x ? upper : rows[hi - 1]!;
  const t = upper === lower ? 0 : (x - lower.at) / (upper.at - lower.at);
  const value = (i: number) => {
    const a = lower.values[i];
    const b = upper.values[i];
    return a === undefined || b === undefined ? undefined : a + (b - a) * t;
  };
  const out: SpectralProperties = { teff: value(0)! };
  const radius = value(1);
  const mass = value(2);
  if (radius !== undefined) out.radius = radius;
  if (mass !== undefined) out.mass = mass;
  return out;
}
