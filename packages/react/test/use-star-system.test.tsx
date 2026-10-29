import { StrictMode, useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemInput } from '@larawag/core';
import { useStarSystem, type StarSystemHandle, type StarSystemProps } from '../src/index.js';
import { created, live, resetFake } from './fake-core.js';

vi.mock('@larawag/core', async () => import('./fake-core.js'));

const sysA: SystemInput = {
  star: { name: 'A', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [{ name: 'b', period: 4.2, radius: 1.5 }],
};
const sysB: SystemInput = {
  star: { name: 'B', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [{ name: 'c', period: 18.5, radius: 3.6 }],
};
const invalid = { invalid: true } as unknown as SystemInput;

let handle: StarSystemHandle | null = null;

function Host({ system, ...props }: StarSystemProps & { system: SystemInput }) {
  const ref = useRef<HTMLDivElement>(null);
  handle = useStarSystem(ref, system, props);
  return <div ref={ref} data-testid="host" />;
}

beforeEach(() => {
  resetFake();
  handle = null;
});
afterEach(cleanup);

describe('useStarSystem', () => {
  it('creates one view on mount and destroys it on unmount', () => {
    const { getByTestId, unmount } = render(
      <Host system={sysA} scaleMode="true" showHabitableZone={false} rate={3} minPlanetPixels={2} fallbackText="no GL" />,
    );
    expect(created).toHaveLength(1);
    const v = created[0]!;
    expect(v.container).toBe(getByTestId('host'));
    expect(v.input).toBe(sysA);
    expect(v.options).toMatchObject({
      scaleMode: 'true',
      showHabitableZone: false,
      rate: 3,
      minPlanetPixels: 2,
      fallbackText: 'no GL',
    });
    expect(v.setScaleMode).not.toHaveBeenCalled();
    expect(v.setHabitableZoneVisible).not.toHaveBeenCalled();
    expect(v.setRate).not.toHaveBeenCalled();
    unmount();
    expect(v.destroy).toHaveBeenCalledTimes(1);
    expect(live()).toHaveLength(0);
  });

  it('leaves exactly one live view under StrictMode', () => {
    render(
      <StrictMode>
        <Host system={sysA} />
      </StrictMode>,
    );
    expect(live()).toHaveLength(1);
    expect(handle!.view).toBe(live()[0]);
  });

  it('calls setSystem only when the system changes by value', () => {
    const { rerender } = render(<Host system={sysA} />);
    const v = created[0]!;
    rerender(<Host system={structuredClone(sysA)} />);
    expect(v.setSystem).not.toHaveBeenCalled();
    rerender(<Host system={sysB} />);
    expect(v.setSystem).toHaveBeenCalledTimes(1);
    expect(v.setSystem).toHaveBeenCalledWith(sysB);
    expect(created).toHaveLength(1);
  });

  it('reports a setSystem error once and keeps the view', () => {
    const onError = vi.fn();
    const { rerender } = render(<Host system={sysA} onError={onError} />);
    rerender(<Host system={invalid} onError={onError} />);
    rerender(<Host system={invalid} onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(live()).toHaveLength(1);
  });

  it('reports an invalid first system and creates the view once a valid one arrives', () => {
    const onError = vi.fn();
    const { rerender } = render(<Host system={invalid} onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(live()).toHaveLength(0);
    expect(handle!.view).toBeNull();
    rerender(<Host system={sysA} onError={onError} />);
    expect(live()).toHaveLength(1);
    expect(live()[0]!.input).toBe(sysA);
  });

  it('maps each runtime input to its setter after creation', () => {
    const { rerender } = render(<Host system={sysA} />);
    const v = created[0]!;
    rerender(<Host system={sysA} scaleMode="true" />);
    expect(v.setScaleMode).toHaveBeenCalledWith('true');
    rerender(<Host system={sysA} scaleMode="true" showHabitableZone={false} />);
    expect(v.setHabitableZoneVisible).toHaveBeenCalledWith(false);
    rerender(<Host system={sysA} scaleMode="true" showHabitableZone={false} rate={5} />);
    expect(v.setRate).toHaveBeenCalledWith(5);
    rerender(<Host system={sysA} scaleMode="true" showHabitableZone={false} rate={5} overlays={{ badge: false }} />);
    expect(v.setOverlays).toHaveBeenCalledWith({ badge: false });
    rerender(<Host system={sysA} scaleMode="true" showHabitableZone={false} rate={5} overlays={{ badge: false }} />);
    expect(v.setScaleMode).toHaveBeenCalledTimes(1);
    expect(v.setHabitableZoneVisible).toHaveBeenCalledTimes(1);
    expect(v.setRate).toHaveBeenCalledTimes(1);
    expect(v.setOverlays).toHaveBeenCalledTimes(1);
  });

  it('controls play and pause through playing', () => {
    const { rerender } = render(<Host system={sysA} />);
    const v = created[0]!;
    expect(v.options.autoplay).toBeUndefined();
    rerender(<Host system={sysA} playing={false} />);
    expect(v.pause).toHaveBeenCalledTimes(1);
    rerender(<Host system={sysA} playing />);
    expect(v.play).toHaveBeenCalledTimes(1);
    rerender(<Host system={sysA} />);
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.pause).toHaveBeenCalledTimes(1);
  });

  it('passes playing as autoplay at creation', () => {
    render(<Host system={sysA} playing={false} autoplay />);
    expect(created[0]!.options.autoplay).toBe(false);
    expect(created[0]!.pause).not.toHaveBeenCalled();
  });

  it('rebuilds the view when a creation-only option changes, keeping the time', () => {
    const { rerender } = render(<Host system={sysA} scaleMode="true" />);
    const first = created[0]!;
    first.setTime(42);
    rerender(<Host system={sysA} scaleMode="true" minPlanetPixels={3} />);
    expect(first.destroyed).toBe(true);
    expect(live()).toHaveLength(1);
    const second = live()[0]!;
    expect(second.options).toMatchObject({ minPlanetPixels: 3, scaleMode: 'true' });
    expect(second.time).toBe(42);
    expect(second.setScaleMode).not.toHaveBeenCalled();
  });

  it('passes planetStyle at creation and rebuilds when it changes', () => {
    const { rerender } = render(<Host system={sysA} planetStyle="prototype" />);
    expect(created[0]!.options.planetStyle).toBe('prototype');
    rerender(<Host system={sysA} planetStyle="inferred" />);
    expect(created[0]!.destroyed).toBe(true);
    expect(live()[0]!.options.planetStyle).toBe('inferred');
  });

  it('calls the latest onTick without resubscribing and stops when it is removed', () => {
    const one = vi.fn();
    const two = vi.fn();
    const { rerender } = render(<Host system={sysA} onTick={one} />);
    const v = created[0]!;
    act(() => v.tick(1));
    expect(one).toHaveBeenCalledWith(1);
    rerender(<Host system={sysA} onTick={two} />);
    act(() => v.tick(2));
    expect(two).toHaveBeenCalledWith(2);
    expect(one).toHaveBeenCalledTimes(1);
    expect(v.onTick).toHaveBeenCalledTimes(1);
    rerender(<Host system={sysA} />);
    act(() => v.tick(3));
    expect(two).toHaveBeenCalledTimes(1);
  });

  it('passes followOnClick at creation and rebuilds when it changes', () => {
    const { rerender } = render(<Host system={sysA} followOnClick />);
    expect(created[0]!.options.followOnClick).toBe(true);
    rerender(<Host system={sysA} />);
    expect(created[0]!.destroyed).toBe(true);
    expect(live()[0]!.options.followOnClick).toBeUndefined();
  });

  it('calls the latest onFollowChange without resubscribing', () => {
    const one = vi.fn();
    const two = vi.fn();
    const { rerender } = render(<Host system={sysA} onFollowChange={one} />);
    const v = created[0]!;
    act(() => v.followChange(0));
    expect(one).toHaveBeenCalledWith(0);
    rerender(<Host system={sysA} onFollowChange={two} />);
    act(() => v.followChange(null));
    expect(two).toHaveBeenCalledWith(null);
    expect(one).toHaveBeenCalledTimes(1);
    expect(v.onFollowChange).toHaveBeenCalledTimes(1);
  });

  it('forwards handle methods to the live view', () => {
    render(<Host system={sysA} />);
    const v = created[0]!;
    handle!.follow(1);
    handle!.unfollow();
    expect(v.follow).toHaveBeenCalledWith(1);
    expect(v.unfollow).toHaveBeenCalled();
    handle!.play();
    handle!.pause();
    handle!.setTime(7);
    handle!.setView('transit');
    handle!.resetView();
    expect(v.play).toHaveBeenCalled();
    expect(v.pause).toHaveBeenCalled();
    expect(v.setTime).toHaveBeenCalledWith(7);
    expect(v.setView).toHaveBeenCalledWith('transit');
    expect(v.resetView).toHaveBeenCalled();
  });
});

describe('useStarSystem playing', () => {
  it('compares playing with the view, not with the last prop', () => {
    const { rerender } = render(<Host system={sysA} playing={false} />);
    const v = created[0]!;
    handle!.play();
    rerender(<Host system={sysA} />);
    rerender(<Host system={sysA} playing={false} />);
    expect(v.pause).toHaveBeenCalledTimes(1);
  });
});
