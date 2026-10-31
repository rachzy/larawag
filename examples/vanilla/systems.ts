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
// Obliquity: NASA axial tilt, degrees.
const solar = (name: string, period: number, radius: number, phase: number, obliquity: number, rings = false) => ({
  name,
  period,
  radius,
  phase,
  obliquity,
  texture: name.toLowerCase(),
  ...(rings ? { rings: true } : {}),
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
        solar('Mercury', 87.969, 0.383, 0.4, 0.03),
        solar('Venus', 224.701, 0.95, 1.7, 177.4),
        solar('Earth', 365.256, 1, 2.9, 23.44),
        solar('Mars', 686.98, 0.532, 4.1, 25.19),
        solar('Jupiter', 4332.589, 10.97, 5.3, 3.13),
        solar('Saturn', 10755.7, 9.14, 0.9, 26.73, true),
        solar('Uranus', 30685.4, 3.98, 2.2, 97.77),
        solar('Neptune', 60189, 3.86, 3.6, 28.32),
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
  {
    id: 'stress-20',
    label: 'Performance test (20 hypothetical planets)',
    rateSlider: 1.5,
    // Stress test: every planet class, all texture presets, colour overrides, both ring forms and tilts.
    input: {
      star: { name: 'Stress test star', spectralType: 'G5V' },
      planets: [
        { name: 'b', period: 0.9, radius: 0.7, phase: 0.2 },
        { name: 'c', period: 1.8, radius: 1.2, phase: 1.1, texture: 'mercury' },
        { name: 'd', period: 3.1, radius: 1.4, phase: 2.3, obliquity: 12 },
        { name: 'e', period: 5.2, radius: 2.1, phase: 3.0 },
        { name: 'f', period: 8.4, radius: 0.95, phase: 4.2, texture: 'venus', obliquity: 177 },
        { name: 'g', period: 12.7, radius: 2.8, phase: 5.1, planetClass: 'ocean-world' },
        { name: 'h', period: 19.3, radius: 1.0, phase: 0.7, texture: 'earth', obliquity: 23.4 },
        { name: 'i', period: 28.5, radius: 4.5, phase: 1.9, rings: true },
        { name: 'j', period: 41.0, radius: 0.55, phase: 2.8, texture: 'mars', obliquity: 25 },
        { name: 'k', period: 60.2, radius: 1.5, phase: 3.7, colour: '#b5654a' },
        { name: 'l', period: 88.0, radius: 3.3, phase: 4.6, texture: 'neptune', obliquity: 28 },
        { name: 'm', period: 130, radius: 7.5, phase: 5.5, obliquity: 8 },
        { name: 'n', period: 190, radius: 1.8, phase: 0.4, planetClass: 'ocean-world', colour: '#2f6f9e' },
        { name: 'o', period: 280, radius: 11.2, phase: 1.5, texture: 'jupiter', obliquity: 3 },
        { name: 'p', period: 410, radius: 5.4, phase: 2.6, rings: { inner: 1.4, outer: 2.0, opacity: 0.5 } },
        { name: 'q', period: 620, radius: 9.1, phase: 3.4, texture: 'saturn', rings: true, obliquity: 26.7 },
        { name: 'r', period: 930, radius: 13.0, phase: 4.3, rings: { inner: 1.3, outer: 2.2, colour: '#c9b38f' }, obliquity: 15 },
        { name: 's', period: 1400, radius: 4.0, phase: 5.2, texture: 'uranus', rings: true, obliquity: 97.8 },
        { name: 't', period: 2100, radius: 2.4, phase: 6.0, colour: '#9fb7c4' },
        { name: 'u', period: 3200, radius: 6.8, phase: 0.9, planetClass: 'gas-giant', obliquity: 40 },
      ],
    },
  },
];
