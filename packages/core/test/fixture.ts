import type { SystemInput } from '../src/physics/types.js';

/** Example system: star 5100 K / 0.80 R☉ / 0.85 M☉ with planets b and c. */
export const fixture: SystemInput = {
  star: { teff: 5100, radius: 0.8, mass: 0.85 },
  planets: [
    { radius: 1.5, period: 4.2 },
    { radius: 3.6, period: 18.5 },
  ],
};
