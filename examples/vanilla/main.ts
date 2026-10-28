import { createStarSystem, type StarSystemView } from '@larawag/core';
import { LarawagValidationError, type PlanetClass, type PlanetInput, type SystemInput } from '@larawag/core/physics';
import { PRESETS, type Preset } from './systems.js';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const stage = $('stage');
const presetSel = $<HTMLSelectElement>('preset');
const playBtn = $<HTMLButtonElement>('play');
const speed = $<HTMLInputElement>('speed');
const speedv = $('speedv');
const scaleBtn = $<HTMLButtonElement>('scale');
const hzBtn = $<HTMLButtonElement>('hz');
const errorsEl = $('errors');
const planetsEl = $('planets');
const cardsEl = $('cards');
const starFields = {
  name: $<HTMLInputElement>('star-name'),
  spectralType: $<HTMLInputElement>('star-spectral'),
  teff: $<HTMLInputElement>('star-teff'),
  radius: $<HTMLInputElement>('star-radius'),
  mass: $<HTMLInputElement>('star-mass'),
};

let view: StarSystemView | null = null;
let trueScale = false;
let hzOn = true;
const debug = new URLSearchParams(location.search).has('debug');

for (const p of PRESETS) presetSel.add(new Option(p.label, p.id));

function setPressed(btn: HTMLButtonElement, pressed: boolean, text: string): void {
  btn.setAttribute('aria-pressed', String(pressed));
  btn.textContent = text;
}

const syncPlay = (): void => setPressed(playBtn, !!view?.playing, view?.playing ? 'Pause' : 'Play');
const syncScale = (): void => setPressed(scaleBtn, trueScale, `True scale: ${trueScale ? 'on' : 'off'}`);
const syncHz = (): void => setPressed(hzBtn, hzOn, `Habitable zone: ${hzOn ? 'on' : 'off'}`);

function syncSpeed(): void {
  const v = Number(speed.value);
  speedv.textContent = `${(10 ** v).toFixed(1)} d/s`;
  view?.setRate(10 ** v);
}

// ---- form <-> input -------------------------------------------------------

const num = (el: HTMLInputElement): number => (el.value.trim() === '' ? NaN : Number(el.value));

function addPlanetRow(p: PlanetInput = { radius: 1, period: 10 }): void {
  const row = document.createElement('div');
  row.className = 'planet';
  const n = planetsEl.children.length + 1;
  const useA = p.period === undefined && p.a !== undefined;
  row.innerHTML = `
    <div class="row">
      <label>Name <input type="text" data-f="name" aria-label="Planet ${n} name"></label>
      <label class="wide">Orbit
        <span class="pair">
          <input type="number" step="any" inputmode="decimal" data-f="orbit" aria-label="Planet ${n} orbit value">
          <select data-f="kind" aria-label="Planet ${n} orbit unit">
            <option value="period">d (period)</option><option value="a">AU (a)</option>
          </select>
        </span>
      </label>
      <label>Radius (R⊕) <input type="number" step="any" inputmode="decimal" data-f="radius" aria-label="Planet ${n} radius"></label>
      <label>Type
        <select data-f="class" aria-label="Planet ${n} type">
          <option value="">Guess from size</option><option value="rocky">Rocky</option>
          <option value="neptune-like">Neptune-like</option><option value="gas-giant">Gas giant</option>
          <option value="ocean-world">Ocean world</option>
        </select>
      </label>
      <label>Phase (rad) <input type="number" step="any" inputmode="decimal" data-f="phase" aria-label="Planet ${n} phase"></label>
      <button type="button" data-f="remove" aria-label="Remove planet ${n}">Remove</button>
    </div>`;
  const f = <T extends HTMLElement>(k: string): T => row.querySelector(`[data-f="${k}"]`) as T;
  f<HTMLInputElement>('name').value = p.name ?? '';
  f<HTMLSelectElement>('kind').value = useA ? 'a' : 'period';
  f<HTMLInputElement>('orbit').value = String(useA ? p.a : p.period ?? '');
  f<HTMLInputElement>('radius').value = String(p.radius);
  f<HTMLSelectElement>('class').value = p.planetClass ?? '';
  f<HTMLInputElement>('phase').value = String(p.phase ?? 0);
  f<HTMLButtonElement>('remove').addEventListener('click', () => {
    row.remove();
    renumber();
    apply();
  });
  planetsEl.appendChild(row);
}

function renumber(): void {
  [...planetsEl.children].forEach((row, i) => {
    const n = i + 1;
    row.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => {
      const label = el.getAttribute('aria-label');
      if (label) el.setAttribute('aria-label', label.replace(/Planet \d+/, `Planet ${n}`));
    });
  });
}

function fillForm(input: SystemInput): void {
  const s = input.star;
  starFields.name.value = s.name ?? '';
  starFields.spectralType.value = s.spectralType ?? '';
  starFields.teff.value = s.teff === undefined ? '' : String(s.teff);
  starFields.radius.value = s.radius === undefined ? '' : String(s.radius);
  starFields.mass.value = s.mass === undefined ? '' : String(s.mass);
  planetsEl.replaceChildren();
  input.planets.forEach((p) => addPlanetRow(p));
}

function readForm(): SystemInput {
  const star: SystemInput['star'] = {};
  const spectralType = starFields.spectralType.value.trim();
  if (spectralType) star.spectralType = spectralType;
  // With a spectral type, empty fields are left for the table to fill.
  for (const k of ['teff', 'radius', 'mass'] as const) {
    if (!spectralType || starFields[k].value.trim() !== '') star[k] = num(starFields[k]);
  }
  if (starFields.name.value.trim()) star.name = starFields.name.value.trim();
  const planets = [...planetsEl.children].map((row): PlanetInput => {
    const f = (k: string): HTMLInputElement => row.querySelector(`[data-f="${k}"]`) as HTMLInputElement;
    const kind = (row.querySelector('[data-f="kind"]') as HTMLSelectElement).value;
    const p: PlanetInput = { radius: num(f('radius')) };
    p[kind === 'a' ? 'a' : 'period'] = num(f('orbit'));
    const phase = num(f('phase'));
    if (!Number.isNaN(phase)) p.phase = phase;
    const name = f('name').value.trim();
    if (name) p.name = name;
    const planetClass = (row.querySelector('[data-f="class"]') as HTMLSelectElement).value;
    if (planetClass) p.planetClass = planetClass as PlanetClass;
    return p;
  });
  return { star, planets };
}

// ---- derived-value cards --------------------------------------------------

function card(title: string, colour: string, kind: string, rows: [string, string][]): HTMLElement {
  const d = document.createElement('div');
  d.className = 'card';
  const h = document.createElement('h3');
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = colour;
  h.append(dot, title);
  const k = document.createElement('div');
  k.className = 'kind';
  k.textContent = kind;
  const dl = document.createElement('dl');
  for (const [a, b] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = a;
    const dd = document.createElement('dd');
    dd.textContent = b;
    dl.append(dt, dd);
  }
  d.append(h, k, dl);
  return d;
}

const fmt = (x: number, digits: number): string =>
  x >= 1e5 ? x.toExponential(2) : x.toFixed(digits);

const classGiven = (i: number): boolean =>
  (planetsEl.children[i]?.querySelector('[data-f="class"]') as HTMLSelectElement | null)?.value !== '';

function renderCards(): void {
  if (!view) return;
  const sys = view.system;
  const s = sys.star;
  const cards = [
    card(s.name, s.colourCss, s.spectralType ? `Star · ${s.spectralType}` : 'Star', [
      ['Teff', `${fmt(s.teff, 0)} K`],
      ['Radius', `${fmt(s.radius, 2)} R☉`],
      ['Mass', `${fmt(s.mass, 2)} M☉`],
      ['Luminosity', `${fmt(s.luminosity, 3)} L☉`],
      ['Habitable zone', `${fmt(sys.habitableZone.inner, 2)} – ${fmt(sys.habitableZone.outer, 2)} AU`],
    ]),
    ...sys.planets.map((p, i) =>
      card(p.name, p.colour, classGiven(i) ? p.planetClass : `${p.planetClass} (a guess from size)`, [
        ['Period', `${fmt(p.periodDays, 1)} d`],
        ['Radius', `${fmt(p.radiusEarth, 2)} R⊕`],
        ['Orbit', `${fmt(p.aAu, 3)} AU`],
        ['Orbit / star radius', fmt(p.aOverRs, 1)],
        ['Orbital speed', `${fmt(p.velocityKmS, 1)} km/s`],
        ['Insolation', `${fmt(p.insolation, 2)} S⊕`],
        ['Teq', `${fmt(p.teq, 0)} K`],
      ]),
    ),
  ];
  cardsEl.replaceChildren(...cards);
}

// ---- wiring ---------------------------------------------------------------

function showErrors(messages: string[]): void {
  errorsEl.replaceChildren(
    ...messages.map((m) => {
      const li = document.createElement('li');
      li.textContent = m;
      return li;
    }),
  );
}

function apply(): void {
  if (!view) return;
  try {
    view.setSystem(readForm());
  } catch (e) {
    if (e instanceof LarawagValidationError) {
      showErrors(e.issues.map((i) => `${i.path}: ${i.message}`));
      return;
    }
    throw e;
  }
  showErrors([]);
  renderCards();
}

function start(preset: Preset): void {
  view?.destroy();
  trueScale = false;
  hzOn = true;
  speed.value = String(preset.rateSlider);
  fillForm(preset.input);
  showErrors([]);
  view = createStarSystem(stage, preset.input, {
    ...preset.options,
    rate: 10 ** preset.rateSlider,
  });
  if (debug) (window as unknown as { __larawagDemo: { view: StarSystemView } }).__larawagDemo = { view };
  syncSpeed();
  syncPlay();
  syncScale();
  syncHz();
  renderCards();
}

presetSel.addEventListener('change', () => {
  const p = PRESETS.find((x) => x.id === presetSel.value);
  if (p) start(p);
});
playBtn.addEventListener('click', () => {
  if (view?.playing) view.pause();
  else view?.play();
  syncPlay();
});
speed.addEventListener('input', syncSpeed);
scaleBtn.addEventListener('click', () => {
  trueScale = !trueScale;
  view?.setScaleMode(trueScale ? 'true' : 'compressed');
  syncScale();
});
hzBtn.addEventListener('click', () => {
  hzOn = !hzOn;
  view?.setHabitableZoneVisible(hzOn);
  syncHz();
});
$('transit').addEventListener('click', () => view?.setView('transit'));
$('reset').addEventListener('click', () => view?.resetView());
$('add').addEventListener('click', () => {
  addPlanetRow({ radius: 1, period: 30 });
  apply();
});
$('form').addEventListener('input', apply);

start(PRESETS[0]!);
