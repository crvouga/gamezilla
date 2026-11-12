import { describe, expect, test } from 'bun:test';
import { syntheticIdentity } from '@libs/product-brand-shared-ts/synthetic-identity';
import {
  brandHost,
  brandOrigin,
} from '@libs/product-identity-shared-ts/brand-hosts';
import {
  resolveIdentityPlaceholders,
  resolveIdentityString,
} from '@libs/product-identity-shared-ts/identity-placeholders';
import {
  PRODUCT,
  type ProductIdentity,
} from '@libs/product-identity-shared-ts/product-identity';
import {
  serviceName,
  technicalKey,
  technicalName,
} from '@libs/product-identity-shared-ts/technical-names';

const SYNTHETIC: ProductIdentity = syntheticIdentity();

describe('derived values follow the identity', () => {
  test('hosts and origins sit under the brand domain', () => {
    expect(brandHost(undefined, SYNTHETIC)).toBe('northwind.example');
    expect(brandHost('api-dev', SYNTHETIC)).toBe('api-dev.northwind.example');
    expect(brandOrigin('www', SYNTHETIC)).toBe('https://www.northwind.example');
  });

  test('technical names come from the namespace alone, whatever the brand', () => {
    for (const identity of [PRODUCT, SYNTHETIC]) {
      const ns = identity.technical.namespace;
      expect(technicalName(['api', 'production'], identity)).toBe(
        `${ns}-api-production`
      );
      expect(serviceName('server', identity)).toBe(`${ns}-server`);
      expect(technicalKey('auth.bearer', '.', identity)).toBe(
        `${ns}.auth.bearer`
      );
    }
    expect(serviceName('client', SYNTHETIC)).toBe(
      serviceName('client', PRODUCT)
    );
    expect(() => technicalName(['Bad Part'])).toThrow('lower-kebab-case');
  });

  test('placeholders resolve to the identity, and only the three tokens do', () => {
    expect(
      resolveIdentityString(
        '{namespace}-shared at {domain} for {brand}',
        SYNTHETIC
      )
    ).toBe(
      `${PRODUCT.technical.namespace}-shared at northwind.example for Northwind Arcade`
    );
    expect(
      resolveIdentityPlaceholders(
        { name: '{namespace}-{suffix}', hosts: ['www.{domain}'], n: 1 },
        SYNTHETIC
      )
    ).toEqual({
      name: `${PRODUCT.technical.namespace}-{suffix}`,
      hosts: ['www.northwind.example'],
      n: 1,
    });
  });
});
