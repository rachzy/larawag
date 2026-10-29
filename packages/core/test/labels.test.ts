// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createLabels } from '../src/render/labels.js';
import { createOverlays } from '../src/render/overlays.js';
import { injectStyles } from '../src/render/styles.js';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

function cam(): PerspectiveCamera {
  const c = new PerspectiveCamera(45, 2, 0.1, 1000);
  c.position.set(0, 0, 10);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('createLabels', () => {
  const planets = [{ name: 'b', periodDays: 4.2 }, { name: 'c', periodDays: 18.5 }];
  it('creates labels with text and removes them on dispose', () => {
    const w = document.createElement('div');
    const l = createLabels(w, planets, { enabled: true });
    const els = w.querySelectorAll<HTMLElement>('.larawag-label');
    expect([...els].map((e) => e.textContent)).toEqual(['b · 4.2 d', 'c · 18.5 d']);
    l.dispose();
    expect(w.querySelectorAll('.larawag-label').length).toBe(0);
  });
  it('positions on screen and hides off-screen or behind camera', () => {
    const w = document.createElement('div');
    const l = createLabels(w, planets, { enabled: true });
    l.update([new Vector3(0, 0, 0), new Vector3(1000, 0, 0)], cam(), 400, 200);
    const [a, b] = [...w.querySelectorAll<HTMLElement>('.larawag-label')];
    expect(a!.style.display).not.toBe('none');
    expect(a!.style.left).toBe('200px');
    expect(a!.style.top).toBe('100px');
    expect(b!.style.display).toBe('none');
    l.update([new Vector3(0, 0, 20), new Vector3(0, 0, 0)], cam(), 400, 200);
    expect(a!.style.display).toBe('none');
  });
  it('spreads overlapping labels downward', () => {
    const w = document.createElement('div');
    const l = createLabels(w, planets, { enabled: true });
    l.update([new Vector3(0, 0, 0), new Vector3(0, 0, 0)], cam(), 400, 200);
    const [a, b] = [...w.querySelectorAll<HTMLElement>('.larawag-label')];
    expect(a!.style.top).toBe('100px');
    expect(b!.style.top).toBe('120px');
  });
  it('setEnabled(false) hides everything', () => {
    const w = document.createElement('div');
    const l = createLabels(w, planets, { enabled: false });
    l.update([new Vector3(), new Vector3()], cam(), 400, 200);
    for (const e of w.querySelectorAll<HTMLElement>('.larawag-label')) expect(e.style.display).toBe('none');
    l.setEnabled(true);
    l.update([new Vector3(), new Vector3()], cam(), 400, 200);
    expect(w.querySelector<HTMLElement>('.larawag-label')!.style.display).not.toBe('none');
  });
});

describe('createOverlays', () => {
  it('shows default clock and badge, updates time', () => {
    const w = document.createElement('div');
    const o = createOverlays(w, { clock: true, badge: true });
    o.setTime(12.345);
    expect(w.querySelector('.larawag-clock')!.textContent).toBe('Simulated time: 12.3 days');
    expect(w.querySelector('.larawag-badge')!.textContent).toBe("Hypothetical · artist's impression");
    o.dispose();
    expect(w.children.length).toBe(0);
  });
  it('supports custom text, format and toggling via setConfig', () => {
    const w = document.createElement('div');
    const o = createOverlays(w, { clock: { format: (d) => `${d} dias` }, badge: { text: 'Hipotético' } });
    o.setTime(3);
    expect(w.querySelector('.larawag-clock')!.textContent).toBe('3 dias');
    expect(w.querySelector('.larawag-badge')!.textContent).toBe('Hipotético');
    o.setConfig({ clock: false, badge: false });
    expect(w.querySelector('.larawag-clock')).toBeNull();
    expect(w.querySelector('.larawag-badge')).toBeNull();
    o.setConfig({ clock: true, badge: { text: 'X' } });
    expect(w.querySelector('.larawag-clock')!.textContent).toBe('Simulated time: 3.0 days');
    expect(w.querySelector('.larawag-badge')!.textContent).toBe('X');
  });
});

describe('injectStyles', () => {
  it('is ref-counted with a single style tag', () => {
    const a = injectStyles();
    const b = injectStyles();
    expect(document.head.querySelectorAll('style[data-larawag]').length).toBe(1);
    expect(document.head.querySelector('style[data-larawag]')!.textContent).toContain('--larawag-label-color');
    const css = document.head.querySelector('style[data-larawag]')!.textContent!;
    for (const cls of ['.larawag-label', '.larawag-unlock']) {
      expect(css).toMatch(new RegExp(`\\${cls}\\{[^}]*user-select:none`));
    }
    a();
    expect(document.head.querySelectorAll('style[data-larawag]').length).toBe(1);
    b();
    expect(document.head.querySelectorAll('style[data-larawag]').length).toBe(0);
    b();
    expect(document.head.querySelectorAll('style[data-larawag]').length).toBe(0);
  });
});
