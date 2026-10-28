import { isTexturePreset, TEXTURE_PRESETS } from './appearance.js';
import { parseHexColour } from './colour.js';
import { RING_INNER, RING_OUTER } from './rings.js';
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

function checkStar(star: Record<string, unknown>, at: string, add: Add, positive: Positive): void {
  const prefix = `${at}.`;
  const spec = star.spectralType;
  const parsed = typeof spec === 'string' ? parseSpectralType(spec) : null;
  let table: SpectralProperties | null = null;
  if (spec !== undefined) {
    if (!parsed) add(`${prefix}spectralType`, `must be a spectral type such as "G2V" (got ${show(spec)})`);
    else if (!(table = spectralProperties(parsed))) add(`${prefix}spectralType`, `must be between O3 and Y4 (got ${show(spec)})`);
  }
  for (const k of ['teff', 'radius', 'mass'] as const) {
    if (star[k] !== undefined || spec === undefined) positive(star, k, prefix, true);
    else if (!parsed || !table) continue;
    else if (k !== 'teff' && !parsed.dwarf) add(`${prefix}${k}`, `required for luminosity class ${parsed.luminosityClass}`);
    else if (table[k] === undefined) add(`${prefix}${k}`, `required, the table has no ${k} for ${spec as string}`);
  }
  checkColour(star.colour, `${prefix}colour`, add);
  positive(star, 'luminosity', prefix, false);
}

function checkHabitableZone(hz: unknown, path: string, add: Add, positive: Positive): void {
  if (hz === undefined) return;
  if (!isObject(hz)) {
    add(path, 'must be an object with inner and outer');
    return;
  }
  positive(hz, 'inner', `${path}.`, true);
  positive(hz, 'outer', `${path}.`, true);
  if (isNum(hz.inner) && isNum(hz.outer) && hz.inner >= hz.outer)
    add(path, `inner must be less than outer (got ${hz.inner} and ${hz.outer})`);
}

function checkColour(colour: unknown, path: string, add: Add): void {
  if (colour !== undefined && (typeof colour !== 'string' || !parseHexColour(colour)))
    add(path, `must be a hex colour such as "#ffcc88" (got ${show(colour)})`);
}

function checkRings(rings: unknown, path: string, add: Add): void {
  if (rings === undefined || typeof rings === 'boolean') return;
  if (!isObject(rings)) {
    add(path, `must be true, false or an object (got ${show(rings)})`);
    return;
  }
  let ok = true;
  for (const k of ['inner', 'outer'] as const) {
    const v = rings[k];
    if (v !== undefined && (!isNum(v) || v <= 1)) {
      add(`${path}.${k}`, `must be greater than 1 (got ${show(v)})`);
      ok = false;
    }
  }
  const inner = (rings.inner as number | undefined) ?? RING_INNER;
  const outer = (rings.outer as number | undefined) ?? RING_OUTER;
  if (ok && inner >= outer) add(path, `inner must be less than outer (got ${inner} and ${outer})`);
  const o = rings.opacity;
  if (o !== undefined && (!isNum(o) || o <= 0 || o > 1)) add(`${path}.opacity`, `must be a number in (0, 1] (got ${show(o)})`);
  checkColour(rings.colour, `${path}.colour`, add);
}

const IMAGE_URL = /^(https?:\/\/|\.{0,2}\/|data:image\/|blob:)/;

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

  const { star, stars, binary } = input;
  if (stars !== undefined) {
    if (star !== undefined) add('stars', 'give either star or stars, not both');
    else if (!Array.isArray(stars) || stars.length !== 2)
      add('stars', `must list exactly 2 stars (got ${Array.isArray(stars) ? stars.length : show(stars)})`);
    else
      stars.forEach((s, i) => {
        const at = `stars[${i}]`;
        if (!isObject(s)) return add(at, 'must be an object');
        checkStar(s, at, add, positive);
        if (s.habitableZone !== undefined) add(`${at}.habitableZone`, 'use binary.habitableZone with two stars');
      });
    if (binary !== undefined) {
      if (!isObject(binary)) add('binary', 'must be an object');
      else {
        positive(binary, 'separation', 'binary.', false);
        if (binary.phase !== undefined && !isNum(binary.phase))
          add('binary.phase', `must be a finite number (got ${show(binary.phase)})`);
        checkHabitableZone(binary.habitableZone, 'binary.habitableZone', add, positive);
      }
    }
  } else if (!isObject(star)) {
    add('star', 'must be an object');
  } else {
    checkStar(star, 'star', add, positive);
    checkHabitableZone(star.habitableZone, 'star.habitableZone', add, positive);
  }
  if (stars === undefined && binary !== undefined) add('binary', 'only with stars');

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
    const t = p.texture;
    if (t !== undefined && !isTexturePreset(t) && !(typeof t === 'string' && IMAGE_URL.test(t)))
      add(`${prefix}texture`, `must be one of ${TEXTURE_PRESETS.join(', ')}, or an image URL (got ${show(t)})`);
    checkColour(p.colour, `${prefix}colour`, add);
    checkRings(p.rings, `${prefix}rings`, add);
    if (p.obliquity !== undefined && !isNum(p.obliquity))
      add(`${prefix}obliquity`, `must be a finite number (got ${show(p.obliquity)})`);
  });
  return issues;
}
