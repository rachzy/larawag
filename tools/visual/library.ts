import { createStarSystem, type StarSystemView } from '@larawag/core';

// The prototype's example system, with its phases (seeds default to the prototype's 11 and 16) and its planet textures.
const view = createStarSystem(
  document.getElementById('stage')!,
  {
    star: { name: 'Example K dwarf', teff: 5100, radius: 0.8, mass: 0.85 },
    planets: [
      { name: 'Candidate b', period: 4.2, radius: 1.5, phase: 0.6 },
      { name: 'Candidate c', period: 18.5, radius: 3.6, phase: 2.9 },
    ],
  },
  { autoplay: false, planetStyle: 'prototype', overlays: { labels: false, clock: false, badge: false } },
);
view.setTime(0);

declare global {
  interface Window {
    __view: StarSystemView;
  }
}
window.__view = view;
