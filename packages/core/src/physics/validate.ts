import { parseHexColour } from './colour.js';
import { parseSpectralType, spectralProperties, type SpectralProperties } from './spectral.js';
import type { ValidationIssue } from './types.js';

const CLASSES = ['rocky', 'neptune-like', 'gas-giant', 'ocean-world'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const show = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** Thrown by `deriveSystem` and `createStarSystem` for invalid input. */
export class LarawagValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(
      `Invalid star system input:\n${issues.map((i) => `${i.path}: ${i.message}`).join('\n')}`,
    );
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'LarawagValidationError';
    this.issues = issues;
  }
}

type Add = (path: string, message: string) => void;
type Positive = (o: Record<string, unknown>, key: string, prefix: string, required: boolean) => void;

function checkStarBasics(star: Record<string, unknown>, add: Add, positive: Positive): void {
  const spec = star.spectralType;
  const parsed = typeof spec === 'string' ? parseSpectralType(spec) : null;
  let table: SpectralProperties | null = null;
  if (spec !== undefined) {
    if (!parsed) add('star.spectralType', `must be a spectral type such as "G2V" (got ${show(spec)})`);
    else if (!(table = spectralProperties(parsed))) add('star.spectralType', `must be between O3 and Y4 (got ${show(spec)})`);
  }
  for (const k of ['teff', 'radius', 'mass'] as const) {
    if (star[k] !== undefined || spec === undefined) positive(star, k, 'star.', true);
    else if (!parsed || !table) continue;
    else if (k !== 'teff' && !parsed.dwarf) add(`star.${k}`, `required for luminosity class ${parsed.luminosityClass}`);
    else if (table[k] === undefined) add(`star.${k}`, `required, the table has no ${k} for ${spec as string}`);
  }
  const colour = star.colour;
  if (colour !== undefined && (typeof colour !== 'string' || !parseHexColour(colour)))
    add('star.colour', `must be a hex colour such as "#ffcc88" (got ${show(colour)})`);
}

/** Checks a system description. Returns every issue found; an empty list means valid. Never throws. */
export function validateSystem(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const positive = (o: Record<string, unknown>, key: string, prefix: string, required: boolean) => {
    const v = o[key];
    if (v === undefined && !required) return;
    if (!isNum(v) || v <= 0) add(`${prefix}${key}`, `must be a positive number (got ${show(v)})`);
  };

  if (!isObject(input)) {
    add('', `must be an object (got ${show(input)})`);
    return issues;
  }

  const star = input.star;
  if (!isObject(star)) {
    add('star', 'must be an object');
  } else {
    checkStarBasics(star, add, positive);
    positive(star, 'luminosity', 'star.', false);
    const hz = star.habitableZone;
    if (hz !== undefined) {
      if (!isObject(hz)) {
        add('star.habitableZone', 'must be an object with inner and outer');
      } else {
        positive(hz, 'inner', 'star.habitableZone.', true);
        positive(hz, 'outer', 'star.habitableZone.', true);
        if (isNum(hz.inner) && isNum(hz.outer) && hz.inner >= hz.outer)
          add('star.habitableZone', `inner must be less than outer (got ${hz.inner} and ${hz.outer})`);
      }
    }
  }

  const planets = input.planets;
  if (!Array.isArray(planets)) {
    add('planets', 'must be an array');
    return issues;
  }
  planets.forEach((p, i) => {
    const at = `planets[${i}]`;
    if (!isObject(p)) {
      add(at, 'must be an object');
      return;
    }
    const prefix = `${at}.`;
    positive(p, 'radius', prefix, true);
    positive(p, 'period', prefix, false);
    positive(p, 'a', prefix, false);
    if (p.period === undefined && p.a === undefined) add(at, 'needs period or a');
    for (const k of ['aOverRs', 'rpOverRs', 'velocity', 'insolation', 'teq', 'seed'])
      positive(p, k, prefix, false);
    if (p.phase !== undefined && !isNum(p.phase))
      add(`${prefix}phase`, `must be a finite number (got ${show(p.phase)})`);
    if (p.albedo !== undefined && (!isNum(p.albedo) || p.albedo < 0 || p.albedo >= 1))
      add(`${prefix}albedo`, `must be a number in [0, 1) (got ${show(p.albedo)})`);
    if (p.planetClass !== undefined && !CLASSES.includes(p.planetClass as string))
      add(`${prefix}planetClass`, `must be one of ${CLASSES.join(', ')} (got ${show(p.planetClass)})`);
  });
  return issues;
}
