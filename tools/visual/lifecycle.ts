import { createStarSystem, LarawagValidationError } from '@larawag/core';
import { bareRenderer } from './bare-renderer';

// Test-only globals: lifecycle.spec.ts drives the library through these.
declare global {
  interface Window {
    __lw: {
      createStarSystem: typeof createStarSystem;
      LarawagValidationError: typeof LarawagValidationError;
      stage: HTMLElement;
      /** A bare renderer disposed the way the library does; its leftovers are three's own per-renderer internals. */
      bareRenderer: () => void;
    };
  }
}
window.__lw = {
  createStarSystem,
  LarawagValidationError,
  stage: document.getElementById('stage')!,
  bareRenderer,
};
