import { describe, expect, it } from 'vitest';
import { parseSpectralType, spectralProperties } from '../src/physics.js';

const props = (text: string) => {
  const parsed = parseSpectralType(text);
  if (!parsed) throw new Error(`did not parse ${text}`);
  return spectralProperties(parsed);
};

describe('parseSpectralType', () => {
  it('parses a main-sequence type', () => {
    expect(parseSpectralType('G2V')).toEqual({
      spectralClass: 'G',
      subclass: 2,
      luminosityClass: 'V',
      dwarf: true,
    });
  });

  it('allows a space before the luminosity class', () => {
    expect(parseSpectralType('G2 V')).toEqual(parseSpectralType('G2V'));
  });

  it('reads decimal subclasses and giants', () => {
    expect(parseSpectralType('K1.5III')).toEqual({
      spectralClass: 'K',
      subclass: 1.5,
      luminosityClass: 'III',
      dwarf: false,
    });
  });

  it('ignores peculiarity suffixes', () => {
    expect(parseSpectralType('M4.5Ve')).toMatchObject({ subclass: 4.5, luminosityClass: 'V', dwarf: true });
  });

  it('takes the first class of a range, and a range with V counts as a dwarf', () => {
    expect(parseSpectralType('K0 III-IV')).toMatchObject({ luminosityClass: 'III', dwarf: false });
    expect(parseSpectralType('F9IV-V')).toMatchObject({ luminosityClass: 'IV', dwarf: true });
    expect(parseSpectralType('G8 IV/V')).toMatchObject({ luminosityClass: 'IV', dwarf: true });
  });

  it('reads supergiant classes', () => {
    expect(parseSpectralType('M1Iab')).toMatchObject({ luminosityClass: 'Iab', dwarf: false });
    expect(parseSpectralType('B8Ia')).toMatchObject({ luminosityClass: 'Ia', dwarf: false });
  });

  it('treats a missing luminosity class as a dwarf and a missing subclass as 5', () => {
    expect(parseSpectralType('K')).toEqual({ spectralClass: 'K', subclass: 5, luminosityClass: null, dwarf: true });
  });

  it('rejects what is not a spectral type', () => {
    for (const t of ['g2v', 'X2V', '', 'G12V', 'G2VII', '2G']) expect(parseSpectralType(t)).toBeNull();
  });
});

describe('spectralProperties', () => {
  it('returns a table row as printed', () => {
    expect(props('G2V')).toEqual({ teff: 5770, radius: 1.012, mass: 1.0 });
  });

  it('interpolates between subclasses', () => {
    expect(props('K2.5V')!.teff).toBeCloseTo(4965, 6);
    expect(props('B0.25V')!.teff).toBeCloseTo(30200, 6);
  });

  it('interpolates across a class boundary', () => {
    expect(props('A9.5V')!.teff).toBeCloseTo((7400 + 7220) / 2, 6);
  });

  it('leaves out what the table does not have', () => {
    expect(props('T0V')).toEqual({ teff: 1255, radius: 0.098 });
    expect(props('L2.5V')!.mass).toBeUndefined();
  });

  it('uses the dwarf table for giants too', () => {
    expect(props('K0III')!.teff).toBe(5270);
  });

  it('returns null outside O3 to Y4', () => {
    expect(props('O2V')).toBeNull();
    expect(props('Y5V')).toBeNull();
    expect(props('Y4V')).toEqual({ teff: 250 });
  });
});
