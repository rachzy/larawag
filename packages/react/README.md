# @larawag/react

[![npm](https://img.shields.io/npm/v/@larawag/react)](https://www.npmjs.com/package/@larawag/react)

React 19 bindings for [`@larawag/core`](https://www.npmjs.com/package/@larawag/core), which draws a hypothetical single-star planetary system with three.js. Everything drawn is hypothetical: the look is a guess from a few numbers, never a claim about a real planet's composition or surface.

## Install

```sh
pnpm add @larawag/react @larawag/core three
```

`@larawag/core`, `react` (19) and `three` (`>=0.186.0 <0.187.0`) are peer dependencies.

## Usage

```tsx
import { useRef } from 'react';
import type { SystemInput } from '@larawag/core';
import { StarSystem, type StarSystemHandle } from '@larawag/react';

const Preview = ({ system }: { system: SystemInput }) => {
  const view = useRef<StarSystemHandle>(null);

  return (
    <div style={{ height: 480 }}>
      <StarSystem system={system} scaleMode="compressed" ref={view} onError={(e) => console.warn(e)} />
      <button onClick={() => view.current?.setView('transit')}>Transit view</button>
    </div>
  );
};
```

The component renders one `div` with `width: 100%; height: 100%`, so size its parent. It creates the view after mount and destroys it on unmount, so it is safe under StrictMode and renders an empty `div` on the server. The file starts with `'use client'` for the Next.js App Router.

`useStarSystem(containerRef, system, props)` mounts the view in an element you render yourself and returns the same handle the component's ref gives you:

```tsx
import { useRef } from 'react';
import type { SystemInput } from '@larawag/core';
import { useStarSystem } from '@larawag/react';

const Stage = ({ system }: { system: SystemInput }) => {
  const container = useRef<HTMLDivElement>(null);
  const view = useStarSystem(container, system, { scaleMode: 'true' });

  return (
    <section>
      <div ref={container} style={{ height: 480 }} />
      <button onClick={() => view.pause()}>Pause</button>
    </section>
  );
};
```

Avoid setting React state from `onTick` on every frame; the clock overlay already shows the time.

The system input, options and view methods are documented in the [main README](https://github.com/rachzy/larawag#readme).

## Licence

MIT
