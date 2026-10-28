# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Larawag

Framework-agnostic three.js library that renders a hypothetical single-star planetary system (one star plus a list of planets, given as numbers) as an interactive 3D scene in a host-provided element. pnpm workspaces monorepo, TypeScript compiled with plain `tsc`.

The library (`packages/core`), the React wrapper (`packages/react`), the demos (`examples/vanilla`, `examples/react`) and the visual harness (`tools/visual`) exist; design notes and plans live in the git-ignored `tmp/plans/`.

- The visual spec is the "Star System Preview" prototype (single HTML page, three r128 UMD). With `planetStyle: 'prototype'` the library must reproduce its canvas without visible change; the default `'inferred'` style changes only planet colours (decided by Henrique, 2026-10-28). Planets, scale modes, camera presets and the starfield are defined by that page and the kickoff prompt; do not restyle the 3D scene.
- Single-star systems only. Circular, coplanar orbits. No moons, binaries or planet picking in v1.
- Everything drawn is hypothetical; never imply known composition or surface. Planet class is a guess from radius and planet colours a guess from class and Teq (`src/physics/appearance.ts`), and the docs say so.

## Workspace layout

- `packages/core` is `@larawag/core`. It exports `"."` (everything) and `"./physics"` (pure functions and types only).
- `src/physics` is pure: no three.js import and no DOM. Keep it that way, since `./physics` must work in node.
- `src/render` holds one file per scene piece. `src/view.ts` (`createStarSystem`) owns the render loop, clock, labels and overlays.
- `packages/react` is `@larawag/react`: `<StarSystem>` and `useStarSystem`, React 19 only, built with plain tsc. Its unit tests mock `@larawag/core`.
- `examples/vanilla` is the Vite demo with an editable star and planet form. `examples/react` (package `react-demo`) shows the same presets and controls through `<StarSystem>`, without the form, and imports the presets from `examples/vanilla/systems.ts`.
- `tools/visual` holds the Playwright screenshot comparison against the original prototype (three r128 served locally, not from a CDN) and the browser lifecycle suites for core and the React wrapper (`probe.ts` is the shared leak instrumentation).
- three is a peerDependency (`>=0.186.0 <0.187.0`) and is pinned exactly to `0.186.1` for development. OrbitControls comes from `three/addons/controls/OrbitControls.js`.

## Commands

`pnpm install`, `pnpm -r build`, `pnpm -r test`, `pnpm --filter @larawag/core test <name>` for a single test file, `pnpm --filter vanilla dev` / `pnpm --filter react-demo dev` for the demos, `pnpm test:visual` for the screenshot comparison and lifecycle suites (run `pnpm --filter @larawag/visual exec playwright install chromium` once first, or set `LARAWAG_CHROMIUM` to another Chromium's executable path). The Vitest fixture is star 5100 K / 0.80 R☉ / 0.85 M☉ with planet b (4.2 d, 1.5 R⊕) and planet c (18.5 d, 3.6 R⊕).

## Conventions

- Any derived value must be overridable by an explicit input, and an explicit input is never recomputed. The host app (Antares, `apps/shaula`) passes values it already computed.
- Colour management matters: three r186 differs from r128 (lighting units, colour management, sRGB output). Parity with the prototype is decided by the screenshot comparison, not by the settings alone.
- Spectral types use the Pecaut & Mamajek dwarf table (Mamajek version 2022-04-16) in `src/physics/spectral-table.ts`. Change its values only from the source table.
- The habitable zone defaults to the prototype's approximation. Add the Kopparapu et al. 2013 model only after its coefficients are checked against the paper.
- Only the text overlays (labels, clock, badge) are customisable, through CSS variables and the `larawag-*` classes. `destroy()` must free everything: loop, observers, GPU resources, labels, injected style.
- Framework wrappers stay thin: they map inputs to core's methods and add no scene options, physics or validation of their own. An Angular wrapper (Angular 22, which needs TypeScript 6.0 in its own package) is planned next.

## Rules for agents

1. Doc comments on the public API, kept short. Elsewhere, comment only when really necessary, in one sentence at most.
2. Never push branches or commits, tag, or publish without being asked. Creating commits is allowed.
3. Commit with Henrique's git identity (the repo's configured user) and add Claude only as a `Co-Authored-By` trailer.
4. Do not commit markdown plans or specs. Keep them in `tmp/plans/`, which is git-ignored.
5. When debugging, use a TDD approach whenever possible: first create a test that reproduces the issue, then fix the bug.
