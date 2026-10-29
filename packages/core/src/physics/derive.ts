import { planetAppearance, type PlanetAppearance } from './appearance.js';
import { deriveRings, type DerivedRings } from './rings.js';
import { AU_PER_RSUN, DEFAULT_ALBEDO, TEFF_SUN } from './constants.js';
import { blackbodyColour, colourToCss, parseHexColour } from './colour.js';
import { classifyPlanet } from './classify.js';
import { habitableZone } from './habitable-zone.js';
import {
  aOverRs,
  equilibriumTemp,
  orbitalSpeedKmS,
  periodDaysFromAu,
  rpOverRs,
  semiMajorAxisAu,
  starLuminosity,
} from './kepler.js';
import { parseSpectralType, spectralProperties } from './spectral.js';
import type { BinaryInput, PlanetClass, StarInput, SystemInput } from './types.js';
import { LarawagValidationError, validateSystem } from './validate.js';

/** A planet with every quantity the renderer and labels need. */
export interface DerivedPlanet {
  name: string;
  /** Orbit line and label colour, CSS hex. */
  colour: string;
  /** How the surface is painted. */
  appearance: PlanetAppearance;
  rings: DerivedRings | null;
  /** Axial tilt, degrees. */
  obliquity: number;
  aAu: number;
  periodDays: number;
  aOverRs: number;
  rpOverRs: number;
  velocityKmS: number;
  /** Stellar flux relative to Earth's. */
  insolation: number;
  /** Equilibrium temperature, K. */
  teq: number;
  planetClass: PlanetClass;
  radiusEarth: number;
  /** Orbital phase, radians. */
  phase: number;
  seed: number;
}

/** A star with its derived luminosity and colour. */
export interface DerivedStar {
  name: string;
  /** As given, or null. */
  spectralType: string | null;
  teff: number;
  radius: number;
  mass: number;
  luminosity: number;
  /** Linear RGB, channels 0..1. */
  colour: [number, number, number];
  colourCss: string;
}

/** The two stars' circular orbit around their centre of mass. */
export interface DerivedBinary {
  /** AU. */
  separation: number;
  periodDays: number;
  /** Each star's distance from the centre of mass, AU. */
  distances: [number, number];
  /** Radians. */
  phase: number;
}

/** A star (or two), the habitable zone and the derived planets. */
export interface DerivedSystem {
  /**
   * The star the planets orbit. With two stars, the pair as one: summed mass and luminosity,
   * star A's radius, and the Teff that gives that luminosity.
   */
  star: DerivedStar;
  /** Every star as drawn: one, or two. */
  stars: DerivedStar[];
  /** The two stars' orbit, or null for one star. */
  binary: DerivedBinary | null;
  habitableZone: { inner: number; outer: number };
  planets: DerivedPlanet[];
}

const PALETTE = ['#c8a27a', '#7fb7d9', '#9fc08a', '#c98f9f', '#b8a6d9', '#d9c27f'];

const defaultName = (i: number) => (i < 25 ? String.fromCharCode(98 + i) : `planet ${i + 1}`);

/** Teff, radius and mass as given, filled from the spectral type where missing. Expects validated input. */
function resolveStar(s: StarInput): { teff: number; radius: number; mass: number } {
  const parsed = s.spectralType === undefined ? null : parseSpectralType(s.spectralType);
  const table = parsed ? spectralProperties(parsed) : null;
  return {
    teff: s.teff ?? table!.teff,
    radius: s.radius ?? table!.radius!,
    mass: s.mass ?? table!.mass!,
  };
}

/**
 * Validates a system description and fills in everything derived from it.
 * Overrides in the input are returned verbatim. Throws `LarawagValidationError`.
 */
export function deriveSystem(input: SystemInput): DerivedSystem {
  const issues = validateSystem(input);
  if (issues.length) throw new LarawagValidationError(issues);

  const given = input.stars ?? [input.star!];
  const stars = given.map((g, i) => deriveStar(g, given.length > 1 ? `Star ${'AB'[i]}` : 'Star'));
  const s = stars.length === 1 ? stars[0]! : combineStars(stars);
  const luminosity = s.luminosity;
  const planets = input.planets.map((p, i): DerivedPlanet => {
    const aAu = p.a ?? semiMajorAxisAu(s.mass, p.period as number);
    const periodDays = p.period ?? periodDaysFromAu(s.mass, aAu);
    const teq = p.teq ?? equilibriumTemp(s.teff, s.radius, aAu, p.albedo ?? DEFAULT_ALBEDO);
    const planetClass = p.planetClass ?? classifyPlanet(p.radius);
    const seed = p.seed ?? 11 + i * 5;
    return {
      name: p.name ?? defaultName(i),
      colour: PALETTE[i % PALETTE.length]!,
      aAu,
      periodDays,
      aOverRs: p.aOverRs ?? aOverRs(aAu, s.radius),
      rpOverRs: p.rpOverRs ?? rpOverRs(p.radius, s.radius),
      velocityKmS: p.velocity ?? orbitalSpeedKmS(s.mass, aAu),
      insolation: p.insolation ?? luminosity / (aAu * aAu),
      teq,
      planetClass,
      radiusEarth: p.radius,
      phase: p.phase ?? 0,
      seed,
      appearance: planetAppearance({ planetClass, teq, seed, texture: p.texture, colour: p.colour }),
      rings: deriveRings(p.rings, teq, seed),
      obliquity: p.obliquity ?? 0,
    };
  });

  const hzOverride = input.stars ? input.binary?.habitableZone : input.star!.habitableZone;
  return {
    star: s,
    stars,
    binary: input.stars ? deriveBinary(stars, input.binary ?? {}) : null,
    habitableZone: hzOverride ?? habitableZone(s),
    planets,
  };
}

function deriveStar(g: StarInput, defaultName: string): DerivedStar {
  const { teff, radius, mass } = resolveStar(g);
  const colour = (g.colour === undefined ? null : parseHexColour(g.colour)) ?? blackbodyColour(teff);
  return {
    name: g.name ?? defaultName,
    spectralType: g.spectralType ?? null,
    teff,
    radius,
    mass,
    luminosity: g.luminosity ?? starLuminosity(teff, radius),
    colour,
    colourCss: colourToCss(colour),
  };
}

/** Two stars as one, for the planets: summed mass and light, the first star's radius. */
function combineStars(stars: DerivedStar[]): DerivedStar {
  const radius = stars[0]!.radius;
  const luminosity = stars.reduce((t, x) => t + x.luminosity, 0);
  const teff = TEFF_SUN * Math.pow(luminosity / (radius * radius), 0.25);
  const colour = blackbodyColour(teff);
  return {
    name: stars.map((x) => x.name).join(' + '),
    spectralType: null,
    teff,
    radius,
    mass: stars.reduce((t, x) => t + x.mass, 0),
    luminosity,
    colour,
    colourCss: colourToCss(colour),
  };
}

function deriveBinary(stars: DerivedStar[], b: BinaryInput): DerivedBinary {
  const [a, c] = stars as [DerivedStar, DerivedStar];
  const total = a.mass + c.mass;
  const separation = b.separation ?? (4 * (a.radius + c.radius)) / AU_PER_RSUN;
  return {
    separation,
    periodDays: periodDaysFromAu(total, separation),
    distances: [(separation * c.mass) / total, (separation * a.mass) / total],
    phase: b.phase ?? 0,
  };
}
