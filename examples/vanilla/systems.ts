import type { SystemInput, ViewOptions } from '@larawag/core';

export interface Preset {
  id: string;
  label: string;
  input: SystemInput;
  options?: ViewOptions;
  /** Speed slider position: simulated days per second = 10 ** rateSlider. */
  rateSlider: number;
}

// Radii: NASA volumetric mean radius / 6371 km. Periods: NASA sidereal, days.
const solar = (name: string, period: number, radius: number, phase: number) => ({
  name,
  period,
  radius,
  phase,
});

export const PRESETS: Preset[] = [
  {
    id: 'k-dwarf',
    label: 'Example K dwarf',
    rateSlider: 0.2,
    input: {
      star: { name: 'Example K dwarf', teff: 5100, radius: 0.8, mass: 0.85 },
      planets: [
        { name: 'Candidate b', period: 4.2, radius: 1.5, phase: 0.6 },
        { name: 'Candidate c', period: 18.5, radius: 3.6, phase: 2.9 },
      ],
    },
  },
  {
    id: 'solar-system',
    label: 'Solar System',
    rateSlider: 1,
    options: { overlays: { badge: { text: "Artist's impression" } } },
    input: {
      star: { name: 'Sun', teff: 5772, radius: 1, mass: 1 },
      planets: [
        solar('Mercury', 87.969, 0.383, 0.4),
        solar('Venus', 224.701, 0.95, 1.7),
        solar('Earth', 365.256, 1, 2.9),
        solar('Mars', 686.98, 0.532, 4.1),
        solar('Jupiter', 4332.589, 10.97, 5.3),
        solar('Saturn', 10755.7, 9.14, 0.9),
        solar('Uranus', 30685.4, 3.98, 2.2),
        solar('Neptune', 60189, 3.86, 3.6),
      ],
    },
  },
];
