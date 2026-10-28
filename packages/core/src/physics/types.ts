/** Rough planet class, guessed from size. */
export type PlanetClass = 'rocky' | 'neptune-like' | 'gas-giant';

/** Host star. Solar units: Teff in K, radius in R☉, mass in M☉. */
export interface StarInput {
  teff: number;
  radius: number;
  mass: number;
  name?: string;
  /** Override: luminosity in L☉. */
  luminosity?: number;
  /** Override: habitable zone edges in AU. */
  habitableZone?: { inner: number; outer: number };
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
}

/** A star and its planets (possibly none). */
export interface SystemInput {
  star: StarInput;
  planets: PlanetInput[];
}

/** One validation problem, located by `path`. */
export interface ValidationIssue {
  path: string;
  message: string;
}
