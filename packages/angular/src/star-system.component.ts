import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  NgZone,
  output,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { createStarSystem, type StarSystemView, type SystemInput, type ViewOptions } from '@larawag/core';

type Overlays = ViewOptions['overlays'];

/** Internal: lets the unit tests replace `createStarSystem`. */
export const STAR_SYSTEM_FACTORY = new InjectionToken<typeof createStarSystem>('STAR_SYSTEM_FACTORY', {
  providedIn: 'root',
  factory: () => createStarSystem,
});

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
};

const sameOverlays = (a: Overlays, b: Overlays): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof NonNullable<Overlays>>;
  return [...keys].every((k) => shallowEqual(a[k], b[k]));
};

/**
 * Renders a star-system view that fills its parent. Inputs map to the view's methods;
 * the render loop runs outside Angular's zone.
 */
@Component({
  selector: 'larawag-star-system',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block; width: 100%; height: 100%' },
})
export class StarSystemComponent {
  /** The star and planets. Compared by value, so a new object with the same content does nothing. */
  readonly system = input.required<SystemInput>();
  /** Calls `setScaleMode` when it changes. */
  readonly scaleMode = input<ViewOptions['scaleMode']>();
  /** Calls `setHabitableZoneVisible` when it changes. */
  readonly showHabitableZone = input<boolean>();
  /** Simulated days per second. Calls `setRate` when it changes. */
  readonly rate = input<number>();
  /** Calls `setOverlays` when it changes (compared field by field). */
  readonly overlays = input<Overlays>();
  /** Left unset, core's autoplay rule applies. Set, it plays or pauses the view. */
  readonly playing = input<boolean>();
  /** Creation only: a change rebuilds the view. */
  readonly autoplay = input<boolean>();
  /** Creation only: a change rebuilds the view. */
  readonly minPlanetPixels = input<number>();
  /** Creation only: a change rebuilds the view. */
  readonly planetStyle = input<ViewOptions['planetStyle']>();
  /** Creation only: a change rebuilds the view. */
  readonly fallbackText = input<string>();
  /** Creation only: a change rebuilds the view. Clicking a planet or its label locks the camera on it. */
  readonly followOnClick = input<boolean>();

  /** Every frame, with the simulated time in days. Emitted outside Angular's zone. */
  readonly tick = output<number>();
  /** The system is invalid. The previous system, if any, stays on screen. */
  readonly error = output<unknown>();
  /** The followed planet's index when the camera locks, and null when it is released. */
  readonly followChange = output<number | null>();

  private readonly live = signal<StarSystemView | null>(null);
  /** The live view, or null before the first render, after destroy, or while the first system is invalid. */
  readonly view: Signal<StarSystemView | null> = this.live.asReadonly();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly create = inject(STAR_SYSTEM_FACTORY);
  private readonly rendered = signal(false);
  private readonly retry = signal(0);
  // What the live view currently shows, so a setter runs only on a real change.
  private applied: { scaleMode?: string; showHabitableZone?: boolean; rate?: number; overlays?: Overlays } = {};
  private attempted: string | null = null;
  private savedTime = 0;

  constructor() {
    afterNextRender(() => this.rendered.set(true));

    effect((onCleanup) => {
      if (!this.rendered()) return;
      this.retry();
      const autoplay = this.autoplay();
      const minPlanetPixels = this.minPlanetPixels();
      const planetStyle = this.planetStyle();
      const fallbackText = this.fallbackText();
      const followOnClick = this.followOnClick();
      untracked(() => this.build({ autoplay, minPlanetPixels, planetStyle, fallbackText, followOnClick }));
      onCleanup(() => {
        const view = this.live();
        if (!view) return;
        this.savedTime = view.time;
        view.destroy();
        this.live.set(null);
      });
    });

    effect(() => {
      const system = this.system();
      const key = JSON.stringify(system);
      if (!this.rendered() || key === this.attempted) return;
      const view = untracked(this.live);
      if (!view) {
        this.retry.update((n) => n + 1);
        return;
      }
      this.attempted = key;
      try {
        view.setSystem(system);
      } catch (e) {
        this.error.emit(e);
      }
    });

    effect(() => {
      const view = this.live();
      const mode = this.scaleMode();
      if (!view || mode === undefined || mode === this.applied.scaleMode) return;
      view.setScaleMode(mode);
      this.applied.scaleMode = mode;
    });

    effect(() => {
      const view = this.live();
      const visible = this.showHabitableZone();
      if (!view || visible === undefined || visible === this.applied.showHabitableZone) return;
      view.setHabitableZoneVisible(visible);
      this.applied.showHabitableZone = visible;
    });

    effect(() => {
      const view = this.live();
      const rate = this.rate();
      if (!view || rate === undefined || rate === this.applied.rate) return;
      view.setRate(rate);
      this.applied.rate = rate;
    });

    effect(() => {
      const view = this.live();
      const overlays = this.overlays();
      if (!view || overlays === undefined || sameOverlays(overlays, this.applied.overlays)) return;
      view.setOverlays(overlays);
      this.applied.overlays = overlays;
    });

    effect(() => {
      const view = this.live();
      const playing = this.playing();
      if (!view || playing === undefined || playing === view.playing) return;
      if (playing) view.play();
      else view.pause();
    });
  }

  play(): void {
    this.live()?.play();
  }

  pause(): void {
    this.live()?.pause();
  }

  setTime(days: number): void {
    this.live()?.setTime(days);
  }

  setView(preset: 'home' | 'transit'): void {
    this.live()?.setView(preset);
  }

  resetView(): void {
    this.live()?.resetView();
  }

  /** Locks the camera on planet `index`. */
  follow(index: number): void {
    this.live()?.follow(index);
  }

  /** Releases the camera where it is. */
  unfollow(): void {
    this.live()?.unfollow();
  }

  private build(
    creation: Pick<ViewOptions, 'autoplay' | 'minPlanetPixels' | 'planetStyle' | 'fallbackText' | 'followOnClick'>,
  ): void {
    const system = this.system();
    this.attempted = JSON.stringify(system);
    const options: ViewOptions = {
      scaleMode: this.scaleMode(),
      showHabitableZone: this.showHabitableZone(),
      rate: this.rate(),
      overlays: this.overlays(),
      ...creation,
      autoplay: this.playing() ?? creation.autoplay,
    };
    try {
      const view = this.zone.runOutsideAngular(() => {
        const v = this.create(this.host, system, options);
        v.onTick((days) => this.tick.emit(days));
        v.onFollowChange((index) => this.followChange.emit(index));
        return v;
      });
      if (this.savedTime > 0) view.setTime(this.savedTime);
      this.applied = {
        scaleMode: options.scaleMode,
        showHabitableZone: options.showHabitableZone,
        rate: options.rate,
        overlays: options.overlays,
      };
      this.live.set(view);
    } catch (e) {
      this.error.emit(e);
    }
  }
}
