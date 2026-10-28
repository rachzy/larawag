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
  texture: name.toLowerCase(),
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
      star: { name: 'Sun', spectralType: 'G2V', teff: 5772, radius: 1, mass: 1 },
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
  {
    id: 'trappist-1',
    label: 'TRAPPIST-1 (star from its spectral type)',
    rateSlider: 0.2,
    // Only the spectral type is given; Teff, radius and mass come from the main-sequence table.
    // Planets: Agol et al. 2021 periods (days) and radii (R⊕).
    input: {
      star: { name: 'TRAPPIST-1', spectralType: 'M8V' },
      planets: [
        { name: 'b', period: 1.5109, radius: 1.116, phase: 0.3 },
        { name: 'c', period: 2.4218, radius: 1.097, phase: 1.4 },
        { name: 'd', period: 4.0496, radius: 0.788, phase: 2.6 },
        { name: 'e', period: 6.0996, radius: 0.92, phase: 3.5 },
        { name: 'f', period: 9.2067, radius: 1.045, phase: 4.4 },
        { name: 'g', period: 12.3529, radius: 1.129, phase: 5.2 },
        { name: 'h', period: 18.7673, radius: 0.755, phase: 6.0 },
      ],
    },
  },
  {
    id: 'blue-dwarf',
    label: 'Blue dwarf (B5V, hypothetical planets)',
    rateSlider: 2,
    // A hot main-sequence (dwarf) star: Teff, radius and mass all come from the B5V table row.
    input: {
      star: { name: 'Blue dwarf', spectralType: 'B5V' },
      planets: [
        { name: 'b', a: 0.6, radius: 1.3, phase: 0.4 },
        { name: 'c', a: 4, radius: 11, phase: 2.1 },
        { name: 'd', a: 28, radius: 2.4, phase: 3.9 },
        { name: 'e', a: 70, radius: 8.5, phase: 5.3 },
      ],
    },
  },
  {
    id: 'red-giant',
    label: 'Red giant (K5III, Aldebaran-like, hypothetical planets)',
    rateSlider: 2,
    // Giants need radius and mass. Teff is given too: the dwarf table's K5 Teff (4440 K) is too hot for a giant.
    input: {
      star: { name: 'Red giant', spectralType: 'K5III', teff: 3900, radius: 44, mass: 1.16 },
      planets: [
        { name: 'b', a: 1.6, radius: 12, phase: 1.1 },
        { name: 'c', a: 5, radius: 3.2, phase: 2.8 },
        { name: 'd', a: 24, radius: 1.8, phase: 4.6 },
      ],
    },
  },
];
