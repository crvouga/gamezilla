import { expect, test } from 'bun:test';
import { materializedIdentity } from './materialize-product-identity-input';

// regression: verification-fixture-production-import
test('verification is explicit and ignores externally supplied branding', () => {
  expect(materializedIdentity('{broken', true)).toEqual(
    materializedIdentity(undefined, true)
  );
  expect(() => materializedIdentity('{broken', false)).toThrow('valid JSON');
  expect(() => materializedIdentity(undefined, false)).toThrow('required');
});
