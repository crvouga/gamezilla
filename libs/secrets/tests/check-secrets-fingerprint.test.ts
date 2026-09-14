import { describe, expect, it } from 'bun:test';
import { computeCheckSecretsFingerprintFromMaps } from '../src/shared/secrets/check-secrets-fingerprint';

describe('computeCheckSecretsFingerprintFromMaps', () => {
  it('is stable for the same maps and changes when a value changes', () => {
    const base = {
      dev: new Map([['AUTH_SECRET', 'a']]),
      prd: new Map([['AUTH_SECRET', 'b']]),
    } as const;
    const fp1 = computeCheckSecretsFingerprintFromMaps(base);
    const fp2 = computeCheckSecretsFingerprintFromMaps({
      dev: new Map([['AUTH_SECRET', 'a']]),
      prd: new Map([['AUTH_SECRET', 'b']]),
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);

    const fp3 = computeCheckSecretsFingerprintFromMaps({
      dev: new Map([['AUTH_SECRET', 'changed']]),
      prd: new Map([['AUTH_SECRET', 'b']]),
    });
    expect(fp3).not.toBe(fp1);
  });
});
