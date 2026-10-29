import { createElement, createRef, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { StarSystem, type StarSystemComponentProps, type StarSystemHandle } from '@larawag/react';
import { bareRenderer } from './bare-renderer';

type Props = Omit<StarSystemComponentProps, 'ref'>;

// Test-only globals: react.spec.ts drives the wrapper through these.
declare global {
  interface Window {
    __rx: {
      mount(props: Props, strict?: boolean): void;
      update(props: Props): void;
      unmount(): void;
      handle(): StarSystemHandle | null;
      stage: HTMLElement;
      bareRenderer: () => void;
    };
  }
}

const stage = document.getElementById('stage')!;
const ref = createRef<StarSystemHandle>();
let root: Root | null = null;
let strictMode = false;

const render = (props: Props): void => {
  const el = createElement(StarSystem, { ...props, ref });
  flushSync(() => root!.render(strictMode ? createElement(StrictMode, null, el) : el));
};

window.__rx = {
  mount(props, strict = false) {
    strictMode = strict;
    root = createRoot(stage);
    render(props);
  },
  update: render,
  unmount() {
    root?.unmount();
    root = null;
  },
  handle: () => ref.current,
  stage,
  bareRenderer,
};
