/** Page instrumentation shared by the browser lifecycle suites. */
import type { StarSystemView } from '@larawag/core';

export interface Probe {
  live: Record<string, number>;
  contexts: number;
  lost: number;
  pendingRaf: number;
}

declare global {
  interface Window {
    __probe: () => Probe;
    __frames: (view: StarSystemView, n?: number) => Promise<void>;
  }
}

/** Runs in the page before any script: counts live GL objects, GL contexts (and which are lost) and pending rAF callbacks. */
export function instrument(): void {
  const kinds = ['Texture', 'Buffer', 'Program', 'Framebuffer', 'Renderbuffer', 'Shader', 'VertexArray'];
  const live = new Set<object>();
  const kindOf = new Map<object, string>();
  for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const kind of kinds) {
      const proto = Ctx.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      const create = proto['create' + kind];
      const del = proto['delete' + kind];
      if (!create || !del || Object.prototype.hasOwnProperty.call(create, '__wrapped')) continue;
      proto['create' + kind] = function (this: unknown, ...a: unknown[]) {
        const o = create.apply(this, a) as object | null;
        if (o) {
          live.add(o);
          kindOf.set(o, kind);
        }
        return o;
      };
      proto['delete' + kind] = function (this: unknown, ...a: unknown[]) {
        const o = a[0] as object | null;
        if (o) live.delete(o);
        return del.apply(this, a);
      };
    }
  }
  const contexts: WebGLRenderingContext[] = [];
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...a: unknown[]) {
    const gl = (getContext as (...x: unknown[]) => unknown).apply(this, a);
    if (gl && /webgl/.test(String(a[0])) && !contexts.includes(gl as WebGLRenderingContext)) contexts.push(gl as WebGLRenderingContext);
    return gl;
  } as typeof getContext;
  const pending = new Set<number>();
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    const id: number = raf((t) => {
      pending.delete(id);
      cb(t);
    });
    pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    caf(id);
  };
  window.__probe = () => {
    const counts: Record<string, number> = {};
    for (const o of live) counts[kindOf.get(o)!] = (counts[kindOf.get(o)!] ?? 0) + 1;
    return {
      live: counts,
      contexts: contexts.length,
      lost: contexts.filter((c) => c.isContextLost()).length,
      pendingRaf: pending.size,
    };
  };
  // Resolves after `n` more rendered frames (onTick runs inside each frame, before its render call).
  window.__frames = (view, n = 3) =>
    new Promise<void>((resolve, reject) => {
      let left = n + 1;
      const timer = setTimeout(() => reject(new Error('no rendered frames')), 15_000); // a stalled loop fails fast
      const off = view.onTick(() => {
        if (--left === 0) {
          off();
          clearTimeout(timer);
          resolve();
        }
      });
    });
}
