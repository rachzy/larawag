import { Component, signal, viewChild } from '@angular/core';
import { LarawagValidationError } from '@larawag/core';
import { StarSystemComponent } from '@larawag/angular';
import { PRESETS } from '../../vanilla/systems';

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({
  selector: 'larawag-demo',
  imports: [StarSystemComponent],
  host: { style: 'display: contents' },
  template: `
    <header>
      <h1>Larawag Angular demo</h1>
      <p class="sub">The same scene as the vanilla demo, drawn through the &lt;larawag-star-system&gt; component. Drag to rotate, scroll to zoom, click a planet to follow it.</p>
    </header>

    <div class="ctl">
      <label for="preset">System
        <select id="preset" [value]="preset().id" (change)="choose($any($event.target).value)">
          @for (p of presets; track p.id) {
            <option [value]="p.id">{{ p.label }}</option>
          }
        </select>
      </label>
    </div>

    <div id="stage" role="group" aria-label="3D view of the star system">
      <larawag-star-system
        [system]="preset().input"
        [overlays]="overlays()"
        [playing]="playing()"
        [rate]="10 ** speed()"
        [scaleMode]="trueScale() ? 'true' : 'compressed'"
        [showHabitableZone]="hz()"
        [followOnClick]="true"
        (error)="showError($event)"
      />
    </div>

    <div class="ctl">
      <button id="play" type="button" [attr.aria-pressed]="playing()" (click)="playing.set(!playing())">{{ playing() ? 'Pause' : 'Play' }}</button>
      <label for="speed">Speed
        <input id="speed" type="range" min="-1" max="2" step="0.05" [value]="speed()" (input)="speed.set(+$any($event.target).value)">
        <span class="note mono">{{ (10 ** speed()).toFixed(1) }} d/s</span>
      </label>
      <button id="scale" type="button" [attr.aria-pressed]="trueScale()" (click)="trueScale.set(!trueScale())">True scale: {{ trueScale() ? 'on' : 'off' }}</button>
      <button id="hz" type="button" [attr.aria-pressed]="hz()" (click)="hz.set(!hz())">Habitable zone: {{ hz() ? 'on' : 'off' }}</button>
      <button id="transit" type="button" (click)="view()?.setView('transit')">Transit view</button>
      <button id="reset" type="button" (click)="view()?.resetView()">Reset view</button>
    </div>

    <ul id="errors" role="alert">
      @for (m of errors(); track m) {
        <li>{{ m }}</li>
      }
    </ul>
  `,
})
export class App {
  protected readonly presets = PRESETS;
  protected readonly preset = signal(PRESETS[0]!);
  protected readonly playing = signal(!reducedMotion());
  protected readonly speed = signal(PRESETS[0]!.rateSlider);
  protected readonly trueScale = signal(false);
  protected readonly hz = signal(true);
  protected readonly errors = signal<string[]>([]);
  protected readonly view = viewChild(StarSystemComponent);

  protected overlays() {
    return { labels: true, clock: true, badge: true, ...this.preset().options?.overlays };
  }

  protected choose(id: string): void {
    const next = PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.preset.set(next);
    this.speed.set(next.rateSlider);
    this.trueScale.set(false);
    this.hz.set(true);
    this.errors.set([]);
    this.view()?.setTime(0);
    this.view()?.resetView();
  }

  protected showError(error: unknown): void {
    this.errors.set(
      error instanceof LarawagValidationError ? error.issues.map((i) => `${i.path}: ${i.message}`) : [String(error)],
    );
  }
}
