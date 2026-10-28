# Larawag

A small, framework-agnostic library that draws a hypothetical planetary system with three.js. You give it a star and a list of planets as numbers; it renders an interactive 3D scene into an element you provide.

Everything drawn is hypothetical. The library picks a plausible look from a few numbers and never claims to know a planet's composition, atmosphere or surface. Show your own "artist's impression" wording next to it, or keep the built-in badge.

## Install

```sh
pnpm add @larawag/core
```

`three` is a peer dependency (`>=0.186.0 <0.187.0`), so your app and Larawag share a single copy. npm 7+ and pnpm 8+ install it automatically if it is missing; with Yarn or older package managers, add `three` yourself.

## Usage

```ts
import { createStarSystem } from '@larawag/core';

const view = createStarSystem(document.getElementById('stage')!, {
  star: { name: 'Example K dwarf', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [
    { name: 'Candidate b', period: 4.2, radius: 1.5, phase: 0.6 },
    { name: 'Candidate c', period: 18.5, radius: 3.6, phase: 2.9 },
  ],
});

view.pause();
view.setScaleMode('true');
view.destroy();
```

Larawag creates one wrapper `div` inside the container and puts the canvas and overlays in it. The wrapper is `height: 100%`, so give the container an explicit height (or a size from its flex or grid parent); a container with automatic height collapses to a thin strip. It draws no buttons; call the methods below from your own controls. Nothing runs at import time, so it can be started and stopped from any framework or none.

## Input

Units: star in solar units (Teff in K, radius in R☉, mass in M☉); planets in days, AU and Earth radii.

| Field | Meaning |
|---|---|
| `star.teff`, `star.radius`, `star.mass` | Positive numbers. Required, unless `star.spectralType` supplies them (see [Spectral types](#spectral-types)). |
| `star.spectralType` | Optional. A spectral type such as `"G2V"`, `"K1.5 III"` or `"M4.5Ve"`. Fills a missing Teff, radius and mass from the main-sequence table. |
| `star.colour` | Optional. Overrides the star colour, as `#rgb` or `#rrggbb`. |
| `planet.radius` | Required. R⊕. |
| `planet.period` or `planet.a` | One is required. Days or AU. With only `a`, the period is derived. With both, both are used as given. |
| `planet.phase` | Radians, default 0. |
| `planet.albedo` | Bond albedo for the equilibrium temperature, default 0.3. |
| `name`, `planet.seed` | Optional. Unnamed planets are labelled b, c, d… up to z, then `planet 26`, `planet 27`… The seed fixes the texture; the default is `11 + 5 × index`. |

Every derived value can be overridden, and an override is never recomputed: `star.luminosity`, `star.habitableZone` (`{ inner, outer }` in AU), and per planet `aOverRs`, `rpOverRs`, `velocity` (km/s), `insolation`, `teq` and `planetClass`.

Invalid input throws a `LarawagValidationError` whose `issues` list has one `{ path, message }` per problem, for example `planets[1].radius: must be a positive number (got -2)`.

## What is derived

Orbit size from Kepler's third law, `a / R*`, `Rp / R*`, orbital speed, insolation in Earth units, and equilibrium temperature. Call `deriveSystem(input)` from `@larawag/core/physics` to get these without a browser; that entry point imports neither three.js nor the DOM.

- **Planet class** (rocky below 1.6 R⊕, Neptune-like from 1.6 to 4, gas giant above) is a guess from radius only.
- **Star colour** is a blackbody approximation of Teff, softened toward white. With only a spectral type, Teff comes from the table below, so the type sets the colour.
- **Habitable zone** is a crude estimate from luminosity (effective fluxes 1.1 and 0.36). Pass `star.habitableZone` if you have a better value.

## Spectral types

`star.spectralType` takes a class letter (O, B, A, F, G, K, M, L, T or Y), a subclass from 0 to 9.5 (5 when left out) and an optional luminosity class (`Ia`, `Iab`, `Ib`, `II`, `III`, `IV`, `V`, `VI`). A space before the luminosity class, ranges such as `IV-V` and peculiarity suffixes such as `e` are accepted. Lowercase class letters and white dwarfs (`D`) are not.

Teff, radius and mass come from the main-sequence table of [Pecaut & Mamajek (2013)](https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt), in Mamajek's version of 2022-04-16, interpolated between subclasses. The table runs from O3V to Y4V.

- A value you pass is always used as given. `teff` wins over the spectral type for physics and colour.
- Where the table has no value (mass from L3 on, radius for most Y types), that field stays required.
- For any luminosity class other than V or VI, `radius` and `mass` stay required, because a giant is far larger than a dwarf of the same type. Teff still comes from the dwarf table, which is a few hundred kelvin off for giants.

Some rows of the table:

| Type | Teff (K) | Radius (R☉) | Mass (M☉) | Looks | Stellar types |
|---|---|---|---|---|---|
| O5V | 41,400 | 11.45 | 43 | blue | blue main-sequence stars, blue giants and supergiants |
| B0V | 31,400 | 7.16 | 17.7 | blue-white | blue-white main-sequence stars, blue giants and supergiants (Rigel) |
| A0V | 9,700 | 2.193 | 2.18 | white | white main-sequence stars (Vega, Sirius A), white giants |
| F0V | 7,220 | 1.728 | 1.61 | yellow-white | yellow-white main-sequence stars, yellow supergiants (Polaris) |
| G2V | 5,770 | 1.012 | 1.00 | warm white | yellow dwarfs (the Sun), yellow giants (Capella) |
| K0V | 5,270 | 0.813 | 0.88 | pale orange | orange dwarfs, red giants (Arcturus, Aldebaran) |
| M0V | 3,850 | 0.588 | 0.57 | orange | red dwarfs, red giants, red supergiants (Betelgeuse, Antares) |
| M5V | 3,060 | 0.196 | 0.162 | orange-red | red dwarfs (Proxima Centauri) |
| L0V | 2,270 | 0.102 | 0.077 | deep red | the coolest red dwarfs, brown dwarfs |
| T0V | 1,255 | 0.098 | not in table | deep red | methane brown dwarfs |
| Y0V | 450 | 0.104 | not in table | dark red | the coolest brown dwarfs |

The "Stellar types" column lists the kinds of stars commonly found with each spectral class, at any luminosity class. Larawag's values are for the main sequence (luminosity class V) only.

```ts
createStarSystem(el, {
  star: { name: 'TRAPPIST-1', spectralType: 'M8V' },
  planets: [{ name: 'e', period: 6.1, radius: 0.92 }],
});
```

## Options

The third argument of `createStarSystem` is optional. Every field is optional too.

| Option | Type | Default | Description |
|---|---|---|---|
| `scaleMode` | `'compressed' \| 'true'` | `'compressed'` | Compressed fits close and wide orbits in one view; true draws the real size ratios. |
| `showHabitableZone` | `boolean` | `true` | Draws the translucent habitable-zone band. |
| `rate` | `number` | `10 ** 0.2` (about 1.58) | Simulated days per second. |
| `autoplay` | `boolean` | `true` | Starts the clock running. Starts paused when the user prefers reduced motion. |
| `minPlanetPixels` | `number` | `0` | True scale only. Minimum on-screen diameter of a planet in pixels; smaller planets are drawn larger. `0` turns it off. |
| `overlays.labels` | `boolean` | `true` | Planet labels projected over the canvas. |
| `overlays.clock` | `boolean \| { format }` | `true` | Simulated-time readout. `format` is `(days: number) => string`. |
| `overlays.badge` | `boolean \| { text }` | `true` | The "Hypothetical · artist's impression" badge. `text` replaces its wording. |
| `fallbackText` | `string` | `'WebGL is not available in this browser, so the 3D view cannot start.'` | Shown instead of the scene when WebGL cannot start. |

This is the default options:

```ts
createStarSystem(container, input, {
  scaleMode: 'compressed',
  showHabitableZone: true,
  rate: 10 ** 0.2,
  autoplay: true,
  minPlanetPixels: 0,
  overlays: {
    labels: true,
    clock: true,
    badge: true,
  },
  fallbackText: 'WebGL is not available in this browser, so the 3D view cannot start.',
});
```

**Scale modes.** Compressed (default) draws the star with a radius of 2 scene units and compresses distances so close and wide orbits both fit. True scale draws the real ratios; planets are close to invisible, which is the honest picture.

## View methods

| Member | Description |
|---|---|
| `play()` / `pause()` | Start or stop the simulation clock. |
| `playing` | Read-only. Whether the clock is running. |
| `setRate(daysPerSecond)` | Sets the simulation speed. Values that are not finite and positive are ignored. |
| `rate` | Read-only. Current speed in simulated days per second. |
| `setTime(days)` | Jumps the clock to a simulated time. |
| `time` | Read-only. Current simulated time in days. |
| `setScaleMode(mode)` | Switches between `'compressed'` and `'true'` and resets the camera. |
| `scaleMode` | Read-only. Current scale mode. |
| `setHabitableZoneVisible(visible)` | Shows or hides the habitable-zone band. |
| `setView('home' \| 'transit')` | Moves the camera to a preset: above and angled, or in the orbital plane so planets cross the star. |
| `resetView()` | Same as `setView('home')`. |
| `setSystem(input)` | Replaces the system (see below). |
| `setOverlays(overlays)` | Changes the `overlays` options after creation. |
| `onTick(callback)` | Calls `callback(days)` every frame. Returns a function that unsubscribes. |
| `destroy()` | Releases everything (see below). Safe to call twice. |
| `system` | Read-only. The derived values for the current system. |

`setSystem` validates first. On an error it throws and the old system keeps running. On success it rebuilds the scene and keeps the camera, scale mode, play state, rate and simulated time, except that the camera goes back to the home view when the new system's outer orbit changes how far the camera must sit.

`destroy()` stops the loop, disposes geometries, materials, textures and the renderer, removes listeners, labels and the injected style, and can be called twice. If WebGL fails to start, `createStarSystem` shows `fallbackText` and returns a view whose methods do nothing (`setSystem` still validates and updates `system`).

## Styling the overlays

Only the text overlays can be restyled; the 3D scene is fixed. Set these CSS variables on the container or any ancestor, or style the classes `larawag-label`, `larawag-clock`, `larawag-badge` and `larawag-fallback` directly.

| Variable | Default |
|---|---|
| `--larawag-font` | `"IBM Plex Mono", ui-monospace, monospace` |
| `--larawag-label-color` | `#e6e9f5` |
| `--larawag-label-bg` | `rgba(7,10,20,.65)` |
| `--larawag-label-border` | `#232a47` |
| `--larawag-clock-color` | `#8e97b8` (also colours the fallback text) |
| `--larawag-badge-color` | `#e8b04a` (also the badge border) |
| `--larawag-badge-bg` | `rgba(7,10,20,.65)` |

Larawag does not load fonts.

## Examples

`examples/vanilla` is a plain HTML demo with a system picker (the example K dwarf, the Solar System, and TRAPPIST-1 given only by its spectral type) and a form to edit the star and planets.

```sh
pnpm install
pnpm --filter vanilla dev
```

## Development

```sh
pnpm -r build
pnpm -r test
pnpm --filter @larawag/core test <name>   # one test file
pnpm test:visual                          # screenshots against the original prototype
```

`pnpm test:visual` needs Playwright's Chromium and compares the library's canvas with the original three r128 page in home view, transit view and true scale.

Run `pnpm --filter @larawag/visual exec playwright install chromium` once before the first `pnpm test:visual`. To use another Chromium build, set `LARAWAG_CHROMIUM` to its executable path.

## Visual behaviour

The scene is the one from the "Star System Preview" prototype. Kept as it was:

- The star: a limb-darkened sphere with an additive glow sprite, both tinted by the blackbody colour of Teff.
- Planets: seeded procedural textures (blotches for rocky planets, bands for Neptune-like planets and gas giants), and an orange emissive glow for planets hotter than 700 K.
- One unit-circle orbit line per planet, in the planet's colour, and a translucent habitable-zone ring.
- About 1800 background stars, placed from a fixed seed.
- Compressed scale (default): the star has radius 2, an orbit of `a` AU has radius `5 + 8 ln(1 + a / 0.05)`, and planet size grows slowly with radius (`0.35 + 0.18 Rp^0.6`, Rp in R⊕). True scale: the star has radius 1, and orbits and planets use `a / R*` and `Rp / R*`.
- A simulation clock in days per second (the demo's speed slider is logarithmic, as in the prototype), home and transit camera presets, and orbit controls with damping.
- Planet labels as HTML elements projected over the canvas.

In `pnpm test:visual` (SwiftShader), the library's canvas is pixel-identical to the prototype's in the three compared views (home, transit, true scale).

## Known limits

- Tested headless (SwiftShader) first; check a real GPU, touch controls and small viewports before relying on it.
- Planet markers at true scale can be smaller than a pixel.
- Labels are spread out vertically to avoid overlap in every view, but crowded systems can still be busy.
- Larawag sets three's global `ColorManagement.enabled = false` when a view is created, which affects other three code on the same page.
- The planet shading patch depends on the exact shader text of three 0.186.x, which is why the peer range is `>=0.186.0 <0.187.0`. If the text changes, creating a view throws a clear error instead of rendering wrong.
- The styles are injected into `document.head`, so a view inside a shadow root is not supported yet.
- Spectral types use the main-sequence table only: giants get a dwarf's Teff, and white dwarfs are not supported.
- At true scale on very wide systems, the camera cannot zoom closer than the minimum distance scaled to fit the system (for the Solar System, the Sun stays a few pixels across).

## TO-DO

- More than one star in a system.
- Moons.
- Eccentric and inclined orbits.
- Habitable zone from the Kopparapu et al. 2013 model, once its coefficients are checked against the paper.
- Framework wrappers (for example `@larawag/react`).
- Shadow DOM support.
- Publish to npm.

## Licence

See `LICENSE`.
