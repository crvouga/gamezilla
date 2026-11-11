import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRODUCT,
  parseProductIdentity,
  productIdentitySchema,
} from '@libs/product-identity-shared-ts/product-identity';
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
