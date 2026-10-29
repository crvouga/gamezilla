import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  parseProductIdentity,
  productIdentitySchema,
} from '@libs/product-identity-shared-ts/product-identity';
import { syntheticIdentity } from '@libs/product-identity-shared-ts/synthetic-identity';
import {
  serviceName,
  technicalKey,
  technicalName,
} from '@libs/product-identity-shared-ts/technical-names';
import { z } from 'zod';

const SCHEMA = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      '../../product-identity/product-identity.schema.json'
    ),
    'utf8'
  )
) as JsonSchema;

type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

/** The object shape of a schema: required keys and each property's shape. */
function shape(schema: JsonSchema): unknown {
  if (schema.properties === undefined)
    return schema.items === undefined ? schema.type : [shape(schema.items)];
  return {
    required: [...(schema.required ?? [])].sort(),
    properties: Object.fromEntries(
      Object.entries(schema.properties)
        .filter(([key]) => key !== '$schema')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, shape(value)])
    ),
  };
}

const SYNTHETIC: ProductIdentity = syntheticIdentity();

describe('the product identity', () => {
  test('the repository file satisfies the neutral schema the TypeScript reader enforces', () => {
    // Both describe the same document: a field added to one and not the
    // other fails here, so Swift or OpenTofu reading the schema and this
    // reader never disagree.
    const fromZod = z.toJSONSchema(productIdentitySchema) as JsonSchema;
    expect(shape(fromZod)).toEqual(shape(SCHEMA));
    expect(parseProductIdentity(PRODUCT)).toEqual(PRODUCT);
  });

  test('an identity breaking the schema is refused with the field named', () => {
    expect(() =>
      parseProductIdentity({
        ...PRODUCT,
        technical: { namespace: 'Has Spaces' },
      })
    ).toThrow('technical.namespace');
    expect(() =>
      parseProductIdentity({
        ...PRODUCT,
        brand: { ...PRODUCT.brand, domain: 'nodot' },
      })
    ).toThrow('brand.domain');
  });
});

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
