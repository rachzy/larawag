/** Rough planet class. Guessed from size when not given; `ocean-world` is never guessed. */
export type PlanetClass = 'rocky' | 'neptune-like' | 'gas-giant' | 'ocean-world';

/**
 * Host star. Solar units: Teff in K, radius in R☉, mass in M☉.
 * `teff`, `radius` and `mass` are required unless `spectralType` supplies them.
 */
export interface StarInput {
  teff?: number;
  radius?: number;
  mass?: number;
  name?: string;
  /** Spectral type such as `"G2V"`; fills missing Teff, radius and mass from the main-sequence table. */
  spectralType?: string;
  /** Override: star colour as `#rgb` or `#rrggbb`. */
  colour?: string;
  /** Override: luminosity in L☉. */
  luminosity?: number;
  /** Override: habitable zone edges in AU. */
  habitableZone?: { inner: number; outer: number };
}

/** Ring overrides. Radii in planet radii. */
export interface RingsInput {
  /** Default 1.2. Must be above 1. */
  inner?: number;
  /** Default 2.3. */
  outer?: number;
  /** `#rgb` or `#rrggbb`. Default from Teq: icy beige-white below 150 K, else dusty grey-brown. */
  colour?: string;
  /** In (0, 1]. Default 0.85 icy, 0.35 dusty. */
  opacity?: number;
}

/** One planet. Period in days, a in AU, radius in R⊕. One of `period` / `a` is required. */
export interface PlanetInput {
  radius: number;
  period?: number;
  a?: number;
  name?: string;
  /** Orbital phase in radians, default 0. */
  phase?: number;
  /** Bond albedo used for teq, default 0.3. */
  albedo?: number;
  /** Override: a / R*. */
  aOverRs?: number;
  /** Override: Rp / R*. */
  rpOverRs?: number;
  /** Override: orbital speed in km/s. */
  velocity?: number;
  /** Override: insolation relative to Earth. */
  insolation?: number;
  /** Override: equilibrium temperature in K. */
  teq?: number;
  planetClass?: PlanetClass;
  /** Texture seed. */
  seed?: number;
  /** A preset look (`'mercury'` … `'neptune'`) or an image URL. Default: inferred from class and temperature. */
  texture?: string;
  /** Surface colour as `#rgb` or `#rrggbb`; replaces the palette and keeps the pattern. */
  colour?: string;
  /** `true` for rings with inferred defaults, or an object of overrides. Default: none. */
  rings?: boolean | RingsInput;
  /** Axial tilt in degrees, default 0. Tilts the planet and its rings. */
  obliquity?: number;
}

/** A star and its planets (possibly none). */
export interface SystemInput {
  /** The star. Give this or `stars`. */
  star?: StarInput;
  /**
   * Two stars, drawn circling each other and treated as one combined star for the planets
   * (summed mass and luminosity). Give this or `star`.
   */
  stars?: [StarInput, StarInput];
  /** Only with `stars`. */
  binary?: BinaryInput;
  planets: PlanetInput[];
}

/** The two stars' own circular orbit. */
export interface BinaryInput {
  /** Distance between the stars in AU. Default 4 × the summed radii. */
  separation?: number;
  /** Starting angle in radians, default 0. */
  phase?: number;
  /** Override: habitable zone edges in AU, around the pair. */
  habitableZone?: { inner: number; outer: number };
}

/** One validation problem, located by `path`. */
export interface ValidationIssue {
  path: string;
  message: string;
}
