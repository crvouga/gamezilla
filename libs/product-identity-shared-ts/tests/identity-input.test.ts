import { expect, test } from 'bun:test';
import {
  configuredIdentity,
  identityInput,
  requireConfiguredIdentity,
} from '@libs/product-identity-shared-ts/identity-input';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('configured identity is required, rather than silently using the verification fixture', () => {
  // regression: committed-brand-rebuild
  expect(() => identityInput('configured', undefined)).toThrow(
    'PRODUCT_IDENTITY_JSON is required'
  );
  expect(() => identityInput('configured', '')).toThrow(
    'PRODUCT_IDENTITY_JSON is required'
  );
  expect(() => identityInput('configured', '{broken')).toThrow(
    'valid JSON document'
  );
});

test('verification is explicit and ignores externally supplied branding', () => {
  expect(identityInput('fixture', '{broken')).toEqual(
    identityInput('fixture', undefined)
  );
});

test('every valid externally supplied brand survives configuration parsing', () => {
  const letters = fc.stringMatching(/^[a-z]{4,12}$/);
  assertProperty(
    'external brand values survive parsing',
    fc.property(letters, letters, (name, label) => {
      const fixture = identityInput('fixture', undefined);
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
      expect(identityInput('configured', JSON.stringify(expected))).toEqual(
        expected
      );
    })
  );
});

test('deployment refuses absent or stale configuration', () => {
  const loaded = identityInput('fixture', undefined);
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
  const fixture = identityInput('fixture', undefined);
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
