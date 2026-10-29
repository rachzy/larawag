import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { StarSystemView, SystemInput, ViewOptions } from '@larawag/core';
import { STAR_SYSTEM_FACTORY, StarSystemComponent } from './star-system.component';

interface FakeView extends Omit<StarSystemView, 'playing' | 'following'> {
  playing: boolean;
  following: number | null;
  container: HTMLElement;
  input: SystemInput;
  options: ViewOptions;
  destroyed: boolean;
  tick(days: number): void;
}

let created: FakeView[] = [];
const live = (): FakeView[] => created.filter((v) => !v.destroyed);
const invalidOf = (input: SystemInput): boolean => (input as { invalid?: boolean }).invalid === true;

function fakeCreate(container: HTMLElement, input: SystemInput, options: ViewOptions = {}): StarSystemView {
  if (invalidOf(input)) throw new Error('invalid system');
  let time = 0;
  const ticks = new Set<(days: number) => void>();
  const followers = new Set<(index: number | null) => void>();
  const view: FakeView = {
    container,
    input,
    options,
    destroyed: false,
    system: {} as StarSystemView['system'],
    playing: options.autoplay ?? true,
    rate: 1,
    scaleMode: options.scaleMode ?? 'compressed',
    get time() {
      return time;
    },
    play: vi.fn(() => {
      view.playing = true;
    }),
    pause: vi.fn(() => {
      view.playing = false;
    }),
    setRate: vi.fn(),
    setTime: vi.fn((d: number) => {
      time = d;
    }),
    setScaleMode: vi.fn(),
    setHabitableZoneVisible: vi.fn(),
    setView: vi.fn(),
    resetView: vi.fn(),
    setSystem: vi.fn((next: SystemInput) => {
      if (invalidOf(next)) throw new Error('invalid system');
    }),
    setOverlays: vi.fn(),
    following: null,
    follow: vi.fn((index: number) => {
      view.following = index;
      for (const cb of followers) cb(index);
    }),
    unfollow: vi.fn(() => {
      view.following = null;
      for (const cb of followers) cb(null);
    }),
    onFollowChange: vi.fn((cb: (index: number | null) => void) => {
      followers.add(cb);
      return () => followers.delete(cb);
    }),
    onTick: vi.fn((cb: (days: number) => void) => {
      ticks.add(cb);
      return () => ticks.delete(cb);
    }),
    destroy: vi.fn(() => {
      view.destroyed = true;
    }),
    tick(days: number) {
      for (const cb of ticks) cb(days);
    },
  };
  created.push(view);
  return view as unknown as StarSystemView;
}

const sysA: SystemInput = {
  star: { name: 'A', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [{ name: 'b', period: 4.2, radius: 1.5 }],
};
const sysB: SystemInput = {
  star: { name: 'B', teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [{ name: 'c', period: 18.5, radius: 3.6 }],
};
const invalid = { invalid: true } as unknown as SystemInput;

type Inputs = Partial<Record<string, unknown>>;

async function mount(inputs: Inputs): Promise<ComponentFixture<StarSystemComponent>> {
  const fixture = TestBed.createComponent(StarSystemComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  await fixture.whenStable();
  return fixture;
}

async function set(fixture: ComponentFixture<StarSystemComponent>, inputs: Inputs): Promise<void> {
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  await fixture.whenStable();
}

beforeEach(() => {
  created = [];
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: STAR_SYSTEM_FACTORY, useValue: fakeCreate }],
  });
});

describe('StarSystemComponent', () => {
  it('creates one view in the host element and destroys it with the component', async () => {
    const fixture = await mount({
      system: sysA,
      scaleMode: 'true',
      showHabitableZone: false,
      rate: 3,
      minPlanetPixels: 2,
      fallbackText: 'no GL',
      planetStyle: 'prototype',
    });
    expect(created).toHaveLength(1);
    const v = created[0]!;
    expect(v.container).toBe(fixture.nativeElement);
    expect(v.input).toBe(sysA);
    expect(v.options).toMatchObject({
      scaleMode: 'true',
      showHabitableZone: false,
      rate: 3,
      minPlanetPixels: 2,
      fallbackText: 'no GL',
      planetStyle: 'prototype',
    });
    expect(v.setScaleMode).not.toHaveBeenCalled();
    expect(v.setHabitableZoneVisible).not.toHaveBeenCalled();
    expect(v.setRate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.view()).toBe(v);
    fixture.destroy();
    expect(v.destroy).toHaveBeenCalledTimes(1);
    expect(live()).toHaveLength(0);
  });

  it('fills its parent', async () => {
    const fixture = await mount({ system: sysA });
    const style = (fixture.nativeElement as HTMLElement).style;
    expect(style.display).toBe('block');
    expect(style.width).toBe('100%');
    expect(style.height).toBe('100%');
  });

  it('calls setSystem only when the system changes by value', async () => {
    const fixture = await mount({ system: sysA });
    const v = created[0]!;
    await set(fixture, { system: structuredClone(sysA) });
    expect(v.setSystem).not.toHaveBeenCalled();
    await set(fixture, { system: sysB });
    expect(v.setSystem).toHaveBeenCalledTimes(1);
    expect(v.setSystem).toHaveBeenCalledWith(sysB);
    expect(created).toHaveLength(1);
  });

  it('emits a setSystem error once and keeps the view', async () => {
    const fixture = await mount({ system: sysA });
    const errors: unknown[] = [];
    fixture.componentInstance.error.subscribe((e) => errors.push(e));
    await set(fixture, { system: invalid });
    await set(fixture, { system: structuredClone(invalid) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(live()).toHaveLength(1);
  });

  it('emits an error for an invalid first system and creates the view once a valid one arrives', async () => {
    const fixture = TestBed.createComponent(StarSystemComponent);
    const errors: unknown[] = [];
    fixture.componentInstance.error.subscribe((e) => errors.push(e));
    fixture.componentRef.setInput('system', invalid);
    await fixture.whenStable();
    expect(errors).toHaveLength(1);
    expect(live()).toHaveLength(0);
    expect(fixture.componentInstance.view()).toBeNull();
    await set(fixture, { system: sysA });
    expect(live()).toHaveLength(1);
    expect(live()[0]!.input).toBe(sysA);
  });

  it('maps each runtime input to its setter after creation', async () => {
    const fixture = await mount({ system: sysA });
    const v = created[0]!;
    await set(fixture, { scaleMode: 'true' });
    expect(v.setScaleMode).toHaveBeenCalledWith('true');
    await set(fixture, { showHabitableZone: false });
    expect(v.setHabitableZoneVisible).toHaveBeenCalledWith(false);
    await set(fixture, { rate: 5 });
    expect(v.setRate).toHaveBeenCalledWith(5);
    await set(fixture, { overlays: { badge: false } });
    expect(v.setOverlays).toHaveBeenCalledWith({ badge: false });
    await set(fixture, { overlays: { badge: false } });
    expect(v.setScaleMode).toHaveBeenCalledTimes(1);
    expect(v.setHabitableZoneVisible).toHaveBeenCalledTimes(1);
    expect(v.setRate).toHaveBeenCalledTimes(1);
    expect(v.setOverlays).toHaveBeenCalledTimes(1);
  });

  it('controls play and pause through playing, compared with the view', async () => {
    const fixture = await mount({ system: sysA });
    const v = created[0]!;
    expect(v.options.autoplay).toBeUndefined();
    await set(fixture, { playing: false });
    expect(v.pause).toHaveBeenCalledTimes(1);
    await set(fixture, { playing: true });
    expect(v.play).toHaveBeenCalledTimes(1);
    fixture.componentInstance.pause();
    await set(fixture, { playing: undefined });
    await set(fixture, { playing: true });
    expect(v.play).toHaveBeenCalledTimes(2);
  });

  it('passes playing as autoplay at creation', async () => {
    await mount({ system: sysA, playing: false, autoplay: true });
    expect(created[0]!.options.autoplay).toBe(false);
    expect(created[0]!.pause).not.toHaveBeenCalled();
  });

  it('rebuilds the view when a creation-only input changes, keeping the time', async () => {
    const fixture = await mount({ system: sysA, scaleMode: 'true' });
    const first = created[0]!;
    first.setTime(42);
    await set(fixture, { minPlanetPixels: 3 });
    expect(first.destroyed).toBe(true);
    expect(live()).toHaveLength(1);
    const second = live()[0]!;
    expect(second.options).toMatchObject({ minPlanetPixels: 3, scaleMode: 'true' });
    expect(second.time).toBe(42);
    expect(second.setScaleMode).not.toHaveBeenCalled();
    expect(fixture.componentInstance.view()).toBe(second);
    await set(fixture, { planetStyle: 'prototype' });
    expect(second.destroyed).toBe(true);
    expect(live()[0]!.options.planetStyle).toBe('prototype');
  });

  it('passes followOnClick at creation, rebuilds when it changes, and emits followChange', async () => {
    const fixture = await mount({ system: sysA, followOnClick: true });
    const first = created[0]!;
    expect(first.options.followOnClick).toBe(true);
    const changes: (number | null)[] = [];
    fixture.componentInstance.followChange.subscribe((i) => changes.push(i));
    fixture.componentInstance.follow(0);
    fixture.componentInstance.unfollow();
    expect(first.follow).toHaveBeenCalledWith(0);
    expect(first.unfollow).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([0, null]);
    await set(fixture, { followOnClick: false });
    expect(first.destroyed).toBe(true);
    expect(live()[0]!.options.followOnClick).toBe(false);
  });

  it('emits tick from the view loop', async () => {
    const fixture = await mount({ system: sysA });
    const days: number[] = [];
    fixture.componentInstance.tick.subscribe((d) => days.push(d));
    created[0]!.tick(1.5);
    expect(days).toEqual([1.5]);
  });

  it('forwards its methods to the live view', async () => {
    const fixture = await mount({ system: sysA });
    const v = created[0]!;
    const c = fixture.componentInstance;
    c.play();
    c.pause();
    c.setTime(7);
    c.setView('transit');
    c.resetView();
    expect(v.play).toHaveBeenCalled();
    expect(v.pause).toHaveBeenCalled();
    expect(v.setTime).toHaveBeenCalledWith(7);
    expect(v.setView).toHaveBeenCalledWith('transit');
    expect(v.resetView).toHaveBeenCalled();
  });

  it('works inside a parent template with bindings', async () => {
    @Component({
      imports: [StarSystemComponent],
      template: `<larawag-star-system [system]="system()" [rate]="rate()" (tick)="last = $event" />`,
    })
    class Host {
      readonly system = signal(sysA);
      readonly rate = signal(2);
      last = 0;
    }
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const v = created[0]!;
    expect(v.options.rate).toBe(2);
    fixture.componentInstance.rate.set(4);
    await fixture.whenStable();
    expect(v.setRate).toHaveBeenCalledWith(4);
    v.tick(3);
    expect(fixture.componentInstance.last).toBe(3);
  });
});
