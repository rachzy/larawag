// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { createStar } from '../src/render/star.js';

// jsdom has no canvas 2D context.
vi.mock('../src/render/textures.js', () => ({ glowTexture: () => new Texture() }));

describe('createStar', () => {
  it('dispose frees the glow texture and sprite geometry as well as the sphere', () => {
    const star = createStar([1, 0.8, 0.5]);
    const spies = [
      vi.spyOn(star.mesh.geometry, 'dispose'),
      vi.spyOn(star.mesh.material as { dispose(): void }, 'dispose'),
      vi.spyOn(star.glow.material, 'dispose'),
      vi.spyOn(star.glow.material.map!, 'dispose'),
      // three shares one geometry between all sprites; its GPU buffers are per renderer.
      vi.spyOn(star.glow.geometry, 'dispose'),
    ];
    star.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
  });
});
