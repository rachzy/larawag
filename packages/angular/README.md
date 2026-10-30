# @larawag/angular

[![npm](https://img.shields.io/npm/v/@larawag/angular)](https://www.npmjs.com/package/@larawag/angular)

Angular 22 bindings for [`@larawag/core`](https://www.npmjs.com/package/@larawag/core), which draws a hypothetical single-star planetary system with three.js. Everything drawn is hypothetical: the look is a guess from a few numbers, never a claim about a real planet's composition or surface.

## Install

npm:

```sh
npm install @larawag/angular @larawag/core three@0.186
```

Yarn:

```sh
yarn add @larawag/angular @larawag/core three@0.186
```

pnpm:

```sh
pnpm add @larawag/angular @larawag/core three@0.186
```

`@angular/core` (22), `@larawag/core` and `three` (`>=0.186.0 <0.187.0`) are peer dependencies.

## Usage

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

The system input, options and view methods are documented in the [main README](https://github.com/rachzy/larawag#readme).

## Licence

MIT
