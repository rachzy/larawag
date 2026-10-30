# Larawag

[![npm](https://img.shields.io/npm/v/@larawag/core)](https://www.npmjs.com/package/@larawag/core) [![npm](https://img.shields.io/npm/v/@larawag/react)](https://www.npmjs.com/package/@larawag/react)

A small, framework-agnostic library that draws a hypothetical planetary system with three.js. You give it a star and a list of planets as numbers; it renders an interactive 3D scene into an element you provide.


Everything drawn is hypothetical. The library picks a plausible look from a few numbers and never claims to know a planet's composition, atmosphere or surface. Show your own "artist's impression" wording next to it, or keep the built-in badge.

**Notes:** This lib was originally created for serving as a 3D engine for rendering hypothetical stellar systems with exoplanet candidates for the [Antares](https://github.com/rachzy/antares) project. **It's NOT 100% stable and was completely vibe-coded.**

## Preview

### Solar System

<figure>
  <img width="975" height="556" alt="image" src="https://github.com/user-attachments/assets/7b911e8c-d6be-4d32-baec-35887e7a3b2f" alt="Solar System rendered through Larawag" />
  <figcaption><i>Solar System rendered through Larawag</i></figcaption>
</figure>

### Example K Dwarf (hypothetical planets)

<figure>
  <img width="969" height="549" alt="image" src="https://github.com/user-attachments/assets/84bea95f-4667-444f-8be1-a453142bbf08" alt="Hypothetical K Dwarf stellar system rendered through Larawag" />
  <figcaption><i>Hypothetical K Dwarf stellar system rendered through Larawag</i></figcaption>
</figure>


## Install

### Vanilla

For the vanilla (simple browser usage) installation:
```sh
pnpm add @larawag/core three
```

### Framework integrations

- [React](#react)
- [Angular](#angular)

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
| `planet.planetClass` | Optional. `'rocky'`, `'neptune-like'`, `'gas-giant'` or `'ocean-world'`. Without it the class is guessed from radius (see below); an ocean world is never guessed. |
| `planet.texture` | Optional. A preset look (`'mercury'`, `'venus'`, `'earth'`, `'mars'`, `'jupiter'`, `'saturn'`, `'uranus'`, `'neptune'`) or an image URL (`http(s)://`, `/`, `./`, `../`, `data:image/`, `blob:`). Default: inferred, see [Planet looks](#planet-looks). |
| `planet.colour` | Optional. Surface colour as `#rgb` or `#rrggbb`. It replaces the palette and keeps the pattern. |
| `planet.rings` | Optional. `true` for rings with inferred defaults, or `{ inner, outer, colour, opacity }` to override any of them (radii in planet radii). Default: no rings. See [Rings](#rings). |
| `planet.obliquity` | Optional. Axial tilt in degrees, default 0. Tilts the planet's spin axis and its rings. |
| `planet.albedo` | Bond albedo for the equilibrium temperature, default 0.3. |
| `name`, `planet.seed` | Optional. Unnamed planets are labelled b, c, d… up to z, then `planet 26`, `planet 27`… The seed fixes the texture; the default is `11 + 5 × index`. |

Every derived value can be overridden, and an override is never recomputed: `star.luminosity`, `star.habitableZone` (`{ inner, outer }` in AU), and per planet `aOverRs`, `rpOverRs`, `velocity` (km/s), `insolation` and `teq`.

Invalid input throws a `LarawagValidationError` whose `issues` list has one `{ path, message }` per problem, for example `planets[1].radius: must be a positive number (got -2)`.

## What is derived

Orbit size from Kepler's third law, `a / R*`, `Rp / R*`, orbital speed, insolation in Earth units, and equilibrium temperature. Call `deriveSystem(input)` from `@larawag/core/physics` to get these without a browser; that entry point imports neither three.js nor the DOM.

- **Planet class** is a guess from radius only: rocky below 1.6 R⊕ (few planets above that size are rocky, Rogers 2015), Neptune-like from 1.6 to 6 R⊕, gas giant from 6 R⊕ (the Kepler size bins of Borucki et al. 2011). Radius cannot tell water from rock, so `ocean-world` is only used when you pass it.
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

## Planet looks

Every planet is painted procedurally on a canvas; nothing is downloaded unless you pass an image URL. The look is decided in this order:

1. `texture` with a preset name: that preset, with its own fixed seed, wherever the planet sits in the list.
2. `texture` with an image URL: the image, loaded as an equirectangular map (cross-origin images need CORS). The inferred look shows while it loads, and stays if it fails.
3. Otherwise the look is inferred: the pattern from the planet class, the colours from the class and the equilibrium temperature (`teq`, including a `teq` you pass).

`colour` replaces the colours of any of these and keeps the pattern (for `earth`, it replaces the ocean).

**Presets**, in approximate true colour:

| Preset | Pattern | Colours |
|---|---|---|
| `mercury` | craters | mid grey with a brown tint |
| `venus` | smooth cloud deck | pale yellow-cream |
| `earth` | oceans, continents, polar caps, clouds | blue, green-brown, white |
| `mars` | craters and polar caps | rust orange, darker brown |
| `jupiter` | bands, seed 31 | the original prototype's gas-giant bands |
| `saturn` | bands, lower contrast | pale butterscotch |
| `uranus` | faint bands | pale cyan |
| `neptune` | faint bands and a dark spot | pale blue, close to Uranus, after the 2024 true-colour reprocessing ([Irwin et al. 2024](https://ora.ox.ac.uk/objects/uuid:bd2a8681-ef1a-4e90-a13f-8d4a69f6b8a6)) |

**Inferred colours.** Patterns: craters for rocky planets, bands for Neptune-like planets and gas giants, oceans with clouds for ocean worlds. Colours by equilibrium temperature (Bond albedo 0.3 unless given):

| Class | Teq | Colours | Basis |
|---|---|---|---|
| rocky | below 150 K | grey-white, blue tint | water ice is stable on airless surfaces |
| rocky | 150 to 500 K | browns and tans (the original prototype's rock) | bare rock, no oceans implied |
| rocky | 500 to 1,000 K | dark basalt greys and browns | hot bare rock |
| rocky | from 1,000 K | near-black crust, orange spots | lava world: the dayside passes rock melting (about 1,400 K) |
| Neptune-like | below 150 K | pale cyan | methane absorbs red light (Uranus, Neptune) |
| Neptune-like | 150 to 700 K | muted grey-blue haze | no colours observed; kept muted |
| Neptune-like | from 700 K | muted grey-tan haze | no colours observed; kept muted |
| gas giant | below 150 K | tan, cream and brown bands | Sudarsky class I, ammonia clouds |
| gas giant | 150 to 350 K | bright white | Sudarsky class II, water clouds |
| gas giant | 350 to 900 K | azure blue | Sudarsky class III, cloudless |
| gas giant | 900 to 1,400 K | very dark blue-grey | Sudarsky class IV, alkali metals |
| gas giant | from 1,400 K | grey-green | Sudarsky class V, silicate clouds |
| ocean world | below 270 K | white and pale blue | frozen |
| ocean world | 270 to 400 K | deep blue | liquid water |
| ocean world | from 400 K | pale grey-white | steam |

Neighbouring rows blend over 50 K, so colours change smoothly with temperature. Each planet's colours then shift by its seed, within ±8° of hue and ±0.08 of lightness, never more saturated, so two similar planets differ a little and nothing turns neon. The Sudarsky classes ([Sudarsky et al. 2000](https://ui.adsabs.harvard.edu/abs/2000ApJ...538..885S/abstract)) are model predictions, and the haze and lava looks are guesses: like everything Larawag draws, the look is hypothetical. The orange glow above 700 K applies to every look.

## Rings

Rings are only drawn when you ask for them: neither size nor temperature predicts them. With `rings: true`:

- They span 1.2 to 2.3 planet radii, like Saturn's main rings (C ring at about 1.24, outer edge of the A ring at about 2.27). Rings sit inside the Roche limit, about 2.4 planet radii for icy material, so the default stays inside it.
- Below 150 K they are icy: bright beige-white and mostly opaque (`#ded0b4`, opacity 0.85), with seeded ringlets and a Cassini-like gap at 1.95 to 2.02 planet radii. Water ice survives at these temperatures.
- From 150 K they are dusty: dark grey-brown and faint (`#6e6258`, opacity 0.35), like the rings of Jupiter, Uranus and Neptune, since ice would sublimate.

Rings lie in the planet's equator, so give the planet an `obliquity` to tilt them; at 0 they lie in the orbital plane and vanish in the transit view. `inner` must be above 1 and below `outer`; `opacity` is in (0, 1]. Rings are unlit and cast no shadows, and the planet casts none on them.

## Options

The third argument of `createStarSystem` is optional. Every field is optional too.

| Option | Type | Default | Description |
|---|---|---|---|
| `scaleMode` | `'compressed' \| 'true'` | `'compressed'` | Compressed fits close and wide orbits in one view; true draws the real size ratios. |
| `showHabitableZone` | `boolean` | `true` | Draws the translucent habitable-zone band. |
| `rate` | `number` | `10 ** 0.2` (about 1.58) | Simulated days per second. |
| `autoplay` | `boolean` | `true` | Starts the clock running. Starts paused when the user prefers reduced motion. |
| `minPlanetPixels` | `number` | `8` (`0` with `planetStyle: 'prototype'`) | True scale only. Minimum on-screen diameter of a planet in pixels, so small planets stay visible; they are drawn larger than their true size. `0` turns it off and shows true sizes. |
| `followOnClick` | `boolean` | `false` | Clicking a planet or its label locks the camera on that planet (see [Following a planet](#following-a-planet)). |
| `overlays.labels` | `boolean` | `true` | Planet labels projected over the canvas. |
| `overlays.clock` | `boolean \| { format }` | `true` | Simulated-time readout. `format` is `(days: number) => string`. |
| `overlays.badge` | `boolean \| { text }` | `true` | The "Hypothetical · artist's impression" badge. `text` replaces its wording. |
| `planetStyle` | `'inferred' \| 'prototype'` | `'inferred'` | How planets without a `texture` or `colour` look: guessed from class and temperature, or the original prototype's textures. Planets with a texture or colour look the same in both. |
| `fallbackText` | `string` | `'WebGL is not available in this browser, so the 3D view cannot start.'` | Shown instead of the scene when WebGL cannot start. |

This is the default options:

```ts
createStarSystem(container, input, {
  scaleMode: 'compressed',
  showHabitableZone: true,
  rate: 10 ** 0.2,
  autoplay: true,
  minPlanetPixels: 8,
  followOnClick: false,
  planetStyle: 'inferred',
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
| `follow(index)` | Locks the camera on planet `index` (in input order); ignored when there is no such planet. Works with or without `followOnClick`. |
| `unfollow()` | Releases the camera where it is. |
| `following` | Read-only. Index of the followed planet, or `null`. |
| `onFollowChange(callback)` | Calls `callback(index)` when the camera locks on a planet and `callback(null)` when it is released. Returns a function that unsubscribes. |
| `setSystem(input)` | Replaces the system (see below). |
| `setOverlays(overlays)` | Changes the `overlays` options after creation. |
| `onTick(callback)` | Calls `callback(days)` every frame. Returns a function that unsubscribes. |
| `destroy()` | Releases everything (see below). Safe to call twice. |
| `system` | Read-only. The derived values for the current system. |

`setSystem` validates first. On an error it throws and the old system keeps running. On success it rebuilds the scene and keeps the camera, scale mode, play state, rate and simulated time, except that the camera goes back to the home view when the new system's outer orbit changes how far the camera must sit. A followed planet stays followed when the new system still has a planet at that index; otherwise the camera is released.

`destroy()` stops the loop, disposes geometries, materials, textures and the renderer, removes listeners, labels and the injected style, and can be called twice. If WebGL fails to start, `createStarSystem` shows `fallbackText` and returns a view whose methods do nothing (`setSystem` still validates and updates `system`).

## Following a planet

With `followOnClick: true`, clicking a planet or its label flies the camera to that planet in under a second (instantly under reduced motion) and then moves it along with the planet, so the planet stays in the centre of the view while it orbits. Dragging still rotates around the planet and the wheel still zooms; panning is off while the camera is locked. Clicking another planet switches to it; clicking the followed one again does nothing.

Only two things release the camera: the Esc key and the "Unlock camera" button that appears in the bottom-right corner while a planet is followed. `setView` and `resetView` also release it, since they move the camera elsewhere; `setScaleMode` keeps the planet and frames it again at the new scale. The camera stays where it was when released.

## Styling the overlays

Only the text overlays can be restyled; the 3D scene is fixed. Set these CSS variables on the container or any ancestor, or style the classes `larawag-label`, `larawag-clock`, `larawag-badge`, `larawag-unlock` and `larawag-fallback` directly. With `followOnClick`, labels also get `larawag-label--clickable`, and the followed planet's label gets `larawag-label--followed`.

| Variable | Default |
|---|---|
| `--larawag-font` | `"IBM Plex Mono", ui-monospace, monospace` |
| `--larawag-label-color` | `#e6e9f5` |
| `--larawag-label-bg` | `rgba(7,10,20,.65)` |
| `--larawag-label-border` | `#232a47` |
| `--larawag-clock-color` | `#8e97b8` (also colours the fallback text) |
| `--larawag-badge-color` | `#e8b04a` (also the badge border) |
| `--larawag-badge-bg` | `rgba(7,10,20,.65)` |
| `--larawag-label-followed-border` | `#e8b04a` (border of the followed planet's label) |
| `--larawag-unlock-color` | `#e6e9f5` |
| `--larawag-unlock-bg` | `rgba(7,10,20,.65)` |
| `--larawag-unlock-border` | `#232a47` |

Larawag does not load fonts.

### React

`@larawag/react` wraps the same view in a component for React 19.

```sh
pnpm add @larawag/react @larawag/core three
```

```tsx
import { useRef } from 'react';
import { StarSystem, type StarSystemHandle } from '@larawag/react';

function Preview({ system }) {
  const view = useRef<StarSystemHandle>(null);
  return (
    <div style={{ height: 480 }}>
      <StarSystem system={system} scaleMode="compressed" ref={view} onError={(e) => console.warn(e)} />
      <button onClick={() => view.current?.setView('transit')}>Transit view</button>
    </div>
  );
}
```

The component renders one `div` with `width: 100%; height: 100%`, so size its parent. It creates the view after mount and destroys it on unmount, so it is safe under StrictMode and renders an empty `div` on the server. The file starts with `'use client'` for the Next.js App Router.

`followOnClick` is a creation-only prop like `planetStyle`, `onFollowChange` receives the followed planet's index (or `null`), and the handle has `follow(index)` and `unfollow()`.

`useStarSystem(containerRef, system, props)` does the same for an element you render yourself and returns the handle.

Avoid setting React state from `onTick` on every frame; the clock overlay already shows the time.

### Angular

`@larawag/angular` wraps the same view in a standalone component for Angular 22, written for zoneless apps.

```sh
pnpm add @larawag/angular @larawag/core three
```

```ts
import { Component, input, viewChild } from '@angular/core';
import { StarSystemComponent } from '@larawag/angular';
import type { SystemInput } from '@larawag/core';

@Component({
  selector: 'app-preview',
  imports: [StarSystemComponent],
  template: `
    <div style="height: 480px">
      <larawag-star-system [system]="system()" scaleMode="compressed" (error)="warn($event)" />
    </div>
    <button (click)="view()?.setView('transit')">Transit view</button>
  `,
})
export class Preview {
  readonly system = input.required<SystemInput>();
  readonly view = viewChild(StarSystemComponent);

  warn(error: unknown) {
    console.warn(error);
  }
}
```

Inputs can also drive the view directly. Here a signal bound to `[playing]` plays and pauses it, with no reference to the component:

```ts
import { Component, input, signal } from '@angular/core';
import { StarSystemComponent } from '@larawag/angular';
import type { SystemInput } from '@larawag/core';

@Component({
  selector: 'app-stage',
  imports: [StarSystemComponent],
  template: `
    <div style="height: 480px">
      <larawag-star-system [system]="system()" scaleMode="true" [playing]="playing()" />
    </div>
    <button (click)="playing.set(!playing())">{{ playing() ? 'Pause' : 'Play' }}</button>
  `,
})
export class Stage {
  readonly system = input.required<SystemInput>();
  readonly playing = signal(true);
}
```

The inputs, outputs and methods match the React props: `system` (compared by value), `scaleMode`, `showHabitableZone`, `rate`, `overlays` and `playing` call the view's methods when they change; `autoplay`, `minPlanetPixels`, `planetStyle`, `followOnClick` and `fallbackText` rebuild the view; `(tick)`, `(error)` and `(followChange)` are outputs; the component has `play()`, `pause()`, `setTime()`, `setView()`, `resetView()`, `follow()`, `unfollow()` and a `view` signal with the live view.

The host element is `display: block; width: 100%; height: 100%`, so size its parent. The view is created after the first render (nothing runs on the server) and destroyed with the component. The render loop runs outside Angular's zone, so apps that still use zone.js do not run change detection every frame; `(tick)` and `(followChange)` are emitted there too. Bind `(tick)` only when you need it, since each emit with a listener schedules change detection in a zoneless app.

## Examples

`examples/vanilla` is a plain HTML demo with a system picker (the example K dwarf, the Solar System with its planet presets, axial tilts and Saturn's rings, TRAPPIST-1 given only by its spectral type, a B5V blue dwarf and a K5III red giant) and a form to edit the star and planets.

```sh
pnpm install
pnpm dev          # same as pnpm --filter vanilla dev
```

`examples/react` shows the same systems and controls through `<StarSystem>` (no editing form):

```sh
pnpm dev:react    # same as pnpm --filter react-demo dev
```

`examples/angular` does the same through `<larawag-star-system>`, as a zoneless Angular 22 app:

```sh
pnpm dev:angular  # same as pnpm --filter angular-demo dev
```

The Angular package and demo use TypeScript 6.0 in their own folders, since Angular 22 does not support TypeScript 7 yet. The demo uses the built `@larawag/angular`, so its `dev` script (`pnpm dev:angular` from the root) builds core and the Angular package before starting.

## Development

The workspace needs Node.js 24.15 or later (with its npm 11) and pnpm 10.28 or later; `.nvmrc` pins Node 24, and `pnpm install` stops with an error on an older Node.

```sh
pnpm -r build
pnpm -r test
pnpm --filter @larawag/core test <name>   # one test file
pnpm test:visual                          # screenshots against the original prototype
```

`pnpm test:visual` needs Playwright's Chromium. It compares the library's canvas with the original three r128 page in home view, transit view and true scale, and checks that the view and the React and Angular wrappers free every GPU object, frame callback and overlay. The Angular suite uses the built package, so build it first.

Run `pnpm --filter @larawag/visual exec playwright install chromium` once before the first `pnpm test:visual`. To use another Chromium build, set `LARAWAG_CHROMIUM` to its executable path.

## Releasing

`@larawag/core` and `@larawag/react` are published to npm with [Changesets](https://github.com/changesets/changesets) and always share one version number.

1. In a PR that changes a published package, run `pnpm changeset`, pick patch, minor or major, and write one line for the changelog.
2. After that PR is merged, the release workflow opens or updates a "Version Packages" PR with the new versions and `CHANGELOG.md` entries.
3. Merging the Version PR publishes to npm through trusted publishing (no npm token) once a maintainer approves the `npm` environment, then tags the release on GitHub.

## Visual behaviour

The scene is the one from the "Star System Preview" prototype. Kept as it was:

- The star: a limb-darkened sphere with an additive glow sprite, both tinted by the blackbody colour of Teff.
- Planets: seeded procedural textures (blotches for rocky planets, bands for Neptune-like planets and gas giants, blue blotches under white cloud streaks for ocean worlds), and an orange emissive glow for planets hotter than 700 K. These are the textures of `planetStyle: 'prototype'`; the default style keeps the patterns and infers the colours (see [Planet looks](#planet-looks)).
- Optional rings: a flat, unlit, see-through ring in the planet's (tilted) equator, painted with ringlets.
- One unit-circle orbit line per planet, in the planet's colour, and a translucent habitable-zone ring.
- About 1800 background stars, placed from a fixed seed.
- Compressed scale (default): the star has radius 2, an orbit of `a` AU has radius `5 + 8 ln(1 + a / 0.05)`, and planet size grows slowly with radius (`0.35 + 0.18 Rp^0.6`, Rp in R⊕). True scale: the star has radius 1, and orbits and planets use `a / R*` and `Rp / R*`.
- A simulation clock in days per second (the demo's speed slider is logarithmic, as in the prototype), home and transit camera presets, and orbit controls with damping.
- Planet labels as HTML elements projected over the canvas.
- Not in the prototype: with `followOnClick`, the camera can follow a planet. It is off by default, so the default scene matches the prototype.

In `pnpm test:visual` (SwiftShader, with `planetStyle: 'prototype'`), the library's canvas is pixel-identical to the prototype's in the three compared views (home, transit, true scale).

## Known limits

- Tested headless (SwiftShader) first; check a real GPU, touch controls and small viewports before relying on it.
- Planet markers at true scale can be smaller than a pixel.
- Labels are spread out vertically to avoid overlap in every view, but crowded systems can still be busy.
- Orbit lines are drawn as polygons, so when following a planet up close at true scale, its orbit line can cross in front of the planet.
- Esc releases a followed planet in every view on the page, since the key is heard on the window.
- Larawag sets three's global `ColorManagement.enabled = false` when a view is created, which affects other three code on the same page.
- The planet shading patch depends on the exact shader text of three 0.186.x, which is why the peer range is `>=0.186.0 <0.187.0`. If the text changes, creating a view throws a clear error instead of rendering wrong.
- The styles are injected into `document.head`, so a view inside a shadow root is not supported yet.
- Image textures load with `crossOrigin = 'anonymous'`, so a server without CORS headers makes the image fail and the inferred look stays.
- Spectral types use the main-sequence table only: giants get a dwarf's Teff, and white dwarfs are not supported.
- At true scale on very wide systems, the camera cannot zoom closer than the minimum distance scaled to fit the system (for the Solar System, the Sun stays a few pixels across). Following a planet lifts this limit for that planet.

## TO-DO

- More than one star in a system.
- Moons.
- Eccentric and inclined orbits.
- Habitable zone from the Kopparapu et al. 2013 model, once its coefficients are checked against the paper.
- Shadow DOM support.
- Publish to npm.

## Licence

See `LICENSE`.
