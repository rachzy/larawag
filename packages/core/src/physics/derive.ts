import { planetAppearance, type PlanetAppearance } from './appearance.js';
import { DEFAULT_ALBEDO } from './constants.js';
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
import type { PlanetClass, StarInput, SystemInput } from './types.js';
import { LarawagValidationError, validateSystem } from './validate.js';

/** A planet with every quantity the renderer and labels need. */
export interface DerivedPlanet {
  name: string;
  /** Orbit line and label colour, CSS hex. */
  colour: string;
  /** How the surface is painted. */
  appearance: PlanetAppearance;
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

/** A star, its habitable zone and its derived planets. */
export interface DerivedSystem {
  star: {
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
  };
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

  const given = input.star;
  const s = { ...given, ...resolveStar(given) };
  const luminosity = s.luminosity ?? starLuminosity(s.teff, s.radius);
  const colour = (s.colour === undefined ? null : parseHexColour(s.colour)) ?? blackbodyColour(s.teff);

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
    };
  });

  return {
    star: {
      name: s.name ?? 'Star',
      spectralType: s.spectralType ?? null,
      teff: s.teff,
      radius: s.radius,
      mass: s.mass,
      luminosity,
      colour,
      colourCss: colourToCss(colour),
    },
    habitableZone: s.habitableZone ?? habitableZone(s),
    planets,
  };
}
