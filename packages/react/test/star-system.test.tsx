import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemInput } from '@larawag/core';
import { StarSystem, type StarSystemHandle } from '../src/index.js';
import { created, resetFake } from './fake-core.js';

vi.mock('@larawag/core', async () => import('./fake-core.js'));

const sys: SystemInput = {
  star: { name: 'A', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [{ name: 'b', period: 4.2, radius: 1.5 }],
};

beforeEach(resetFake);
afterEach(cleanup);

describe('<StarSystem>', () => {
  it('renders a full-size div with the given class and style and mounts the view in it', () => {
    const { container } = render(<StarSystem system={sys} className="stage" style={{ minHeight: 300 }} />);
    const div = container.firstElementChild as HTMLDivElement;
    expect(div.className).toBe('stage');
    expect(div.style.width).toBe('100%');
    expect(div.style.height).toBe('100%');
    expect(div.style.minHeight).toBe('300px');
    expect(created[0]!.container).toBe(div);
  });

  it('exposes the handle through ref, and null after unmount', () => {
    const ref = createRef<StarSystemHandle>();
    const { unmount } = render(<StarSystem system={sys} rate={2} ref={ref} />);
    const v = created[0]!;
    expect(ref.current!.view).toBe(v);
    expect(v.options.rate).toBe(2);
    ref.current!.setView('transit');
    expect(v.setView).toHaveBeenCalledWith('transit');
    const handle = ref.current!;
    unmount();
    expect(handle.view).toBeNull();
    expect(v.destroy).toHaveBeenCalledTimes(1);
  });
});
