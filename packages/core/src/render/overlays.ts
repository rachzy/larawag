/** Clock and badge options. `true` uses the default text. */
export interface OverlayConfig {
  clock: boolean | { format?: (days: number) => string };
  badge: boolean | { text?: string };
}

/** Clock and badge overlay handle. */
export interface Overlays {
  setTime(days: number): void;
  setConfig(cfg: OverlayConfig): void;
  dispose(): void;
}

const DEFAULT_BADGE = "Hypothetical · artist's impression";
const defaultFormat = (days: number): string => `Simulated time: ${days.toFixed(1)} days`;

/** Creates the clock (bottom-left) and badge (top-right) inside `wrapper`. */
export function createOverlays(wrapper: HTMLElement, cfg: OverlayConfig): Overlays {
  let clockEl: HTMLElement | null = null;
  let badgeEl: HTMLElement | null = null;
  let days = 0;
  let format = defaultFormat;

  const render = (): void => {
    if (clockEl) clockEl.textContent = format(days);
  };
  const apply = (c: OverlayConfig): void => {
    if (c.clock) {
      format = (typeof c.clock === 'object' && c.clock.format) || defaultFormat;
      if (!clockEl) {
        clockEl = document.createElement('div');
        clockEl.className = 'larawag-clock';
        wrapper.appendChild(clockEl);
      }
      render();
    } else if (clockEl) {
      clockEl.remove();
      clockEl = null;
    }
    if (c.badge) {
      if (!badgeEl) {
        badgeEl = document.createElement('div');
        badgeEl.className = 'larawag-badge';
        wrapper.appendChild(badgeEl);
      }
      badgeEl.textContent = (typeof c.badge === 'object' && c.badge.text) || DEFAULT_BADGE;
    } else if (badgeEl) {
      badgeEl.remove();
      badgeEl = null;
    }
  };
  apply(cfg);
  return {
    setTime(d) {
      days = d;
      render();
    },
    setConfig: apply,
    dispose() {
      clockEl?.remove();
      badgeEl?.remove();
      clockEl = badgeEl = null;
    },
  };
}

/** The "Unlock camera" button (bottom-right) shown while the camera follows a planet. */
export interface UnlockButton {
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** Creates the hidden `button.larawag-unlock` inside `wrapper`. */
export function createUnlockButton(wrapper: HTMLElement, onClick: () => void): UnlockButton {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'larawag-unlock';
  el.textContent = 'Unlock camera';
  el.hidden = true;
  el.addEventListener('click', onClick);
  wrapper.appendChild(el);
  return {
    setVisible(v) {
      el.hidden = !v;
    },
    dispose() {
      el.remove();
    },
  };
}
