import '@angular/compiler';
import { createComponent, provideZonelessChangeDetection, type ComponentRef } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type { StarSystemView } from '@larawag/core';
import { StarSystemComponent } from '@larawag/angular';
import { bareRenderer } from './bare-renderer';

type Inputs = Record<string, unknown>;

// Test-only globals: angular.spec.ts drives the component through these.
declare global {
  interface Window {
    __ng: {
      mount(inputs: Inputs): Promise<void>;
      update(inputs: Inputs): Promise<void>;
      unmount(): void;
      view(): StarSystemView | null;
      call(method: 'play' | 'pause' | 'setTime' | 'setView' | 'resetView', arg?: unknown): void;
      stage: HTMLElement;
      bareRenderer: () => void;
    };
  }
}

const stage = document.getElementById('stage')!;
const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
let ref: ComponentRef<StarSystemComponent> | null = null;

async function apply(inputs: Inputs): Promise<void> {
  for (const [k, v] of Object.entries(inputs)) ref!.setInput(k, v);
  await app.whenStable();
}

window.__ng = {
  async mount(inputs) {
    const host = document.createElement('larawag-star-system');
    stage.appendChild(host);
    ref = createComponent(StarSystemComponent, { environmentInjector: app.injector, hostElement: host });
    app.attachView(ref.hostView);
    await apply(inputs);
  },
  update: apply,
  unmount() {
    const host = ref!.location.nativeElement as HTMLElement;
    ref!.destroy();
    host.remove();
    ref = null;
  },
  view: () => ref?.instance.view() ?? null,
  call(method, arg) {
    (ref!.instance[method] as (a?: unknown) => void)(arg);
  },
  stage,
  bareRenderer,
};
