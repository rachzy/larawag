import type { PlanetClass } from './types.js';

/** Guess a planet class from its radius in R⊕: below 1.6 rocky, below 6 neptune-like, else gas giant. */
export function classifyPlanet(rpEarth: number): PlanetClass {
  return rpEarth < 1.6 ? 'rocky' : rpEarth < 6 ? 'neptune-like' : 'gas-giant';
}
