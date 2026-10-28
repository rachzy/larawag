import { describe, expect, it } from 'vitest';
import { blackbodyColour, colourToCss, parseHexColour } from '../src/physics.js';

describe('blackbodyColour', () => {
  it('cool star is red-orange', () => {
    const [r, g, b] = blackbodyColour(3000);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThanOrEqual(0.9);
  });

  it('sun is near white', () => {
    for (const ch of blackbodyColour(5772)) expect(ch).toBeGreaterThanOrEqual(0.9);
  });

  it('hot star is blue-white', () => {
    const [r, , b] = blackbodyColour(9000);
    expect(b).toBeGreaterThanOrEqual(r);
  });

  it('channels stay within [0.2, 1]', () => {
    for (const t of [1000, 2500, 3000, 5100, 5772, 9000, 30000, 40000]) {
      for (const ch of blackbodyColour(t)) {
        expect(ch).toBeGreaterThanOrEqual(0.2);
        expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('colourToCss', () => {
  it('rounds channels to 0-255', () => {
    expect(colourToCss([1, 0.2, 0.5])).toBe('rgb(255,51,128)');
  });
});

describe('parseHexColour', () => {
  it('reads long and short hex, any case', () => {
    expect(parseHexColour('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(parseHexColour('#FC8')).toEqual([1, 0xcc / 255, 0x88 / 255]);
  });

  it('rejects anything else', () => {
    for (const t of ['orange', 'ff8000', '#ff800', '#ggg', 'rgb(1,2,3)', '']) expect(parseHexColour(t)).toBeNull();
  });
});
