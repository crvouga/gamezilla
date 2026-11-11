import { expect, test } from 'bun:test';
import {
  configuredIdentity,
  identityInput,
  requireConfiguredIdentity,
} from '@libs/product-brand-shared-ts/identity-input';
import fixtureInput from '@libs/product-identity/fixtures/verification-identity.json' with {
  type: 'json',
};
import { parseProductIdentity } from '@libs/product-identity-shared-ts/identity-schema';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const verificationIdentity = () => parseProductIdentity(fixtureInput);

test('configured identity is required, rather than silently using the verification fixture', () => {
  // regression: committed-brand-rebuild
  expect(() => identityInput(undefined)).toThrow(
    'PRODUCT_IDENTITY_JSON is required'
  );
  expect(() => identityInput('')).toThrow('PRODUCT_IDENTITY_JSON is required');
  expect(() => identityInput('{broken')).toThrow('valid JSON document');
});

test('every valid externally supplied brand survives configuration parsing', () => {
  const letters = fc.stringMatching(/^[a-z]{4,12}$/);
  assertProperty(
    'external brand values survive parsing',
    fc.property(letters, letters, (name, label) => {
      const fixture = verificationIdentity();
      const expected = {
        ...fixture,
        brand: {
          ...fixture.brand,
          name,
          shortName: name,
          domain: `${label}.example`,
          securityContact: `mailto:security@${label}.example`,
        },
      };
      expect(identityInput(JSON.stringify(expected))).toEqual(expected);
    })
  );
});

test('deployment refuses absent or stale configuration', () => {
  const loaded = verificationIdentity();
  expect(() => requireConfiguredIdentity(undefined, loaded)).toThrow(
    'required'
  );
  const desired = {
    ...loaded,
    brand: { ...loaded.brand, name: 'Changed Fixture' },
  };
  expect(() =>
    requireConfiguredIdentity(JSON.stringify(desired), loaded)
  ).toThrow('differs from external configuration');
  expect(() =>
    requireConfiguredIdentity(JSON.stringify(desired), desired)
  ).not.toThrow();
});

test('external configuration can come from the repository without overriding injected input', () => {
  const fixture = verificationIdentity();
  let reads = 0;
  const repository = () => {
    reads++;
    return JSON.stringify(fixture);
  };
  expect(configuredIdentity(undefined, repository)).toEqual(fixture);
  expect(reads).toBe(1);
  expect(configuredIdentity(JSON.stringify(fixture), repository)).toEqual(
    fixture
  );
  expect(reads).toBe(1);
  expect(() => configuredIdentity('{broken', repository)).toThrow('valid JSON');
  expect(reads).toBe(1);
});
