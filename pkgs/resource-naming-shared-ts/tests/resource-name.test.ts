import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  PROVIDER_RULES,
  type ResourceKind,
} from '@pkgs/resource-naming-shared-ts/provider-rules';
import {
  nameViolations,
  resourceName,
  stableHash,
} from '@pkgs/resource-naming-shared-ts/resource-name';
import fc from 'fast-check';

const KINDS = Object.keys(PROVIDER_RULES) as ResourceKind[];
const part = fc.stringMatching(/^[A-Za-z0-9 _.@=,+-]{1,40}$/);

describe('resourceName', () => {
  test('a short valid name passes through unchanged', () => {
    expect(
      resourceName('cloudflare-worker', ['acme', 'api', 'production'])
    ).toBe('acme-api-production');
    expect(resourceName('cloudflare-r2-bucket', ['acme', 'shared'])).toBe(
      'acme-shared'
    );
  });

  test('every name it returns is one its provider accepts, and the same every time', () => {
    assertProperty(
      'resource-name-valid',
      fc.property(
        fc.constantFrom(...KINDS),
        fc.array(part, { minLength: 1, maxLength: 6 }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
          nil: undefined,
        }),
        (kind, parts, uniqueIn) => {
          let name: string;
          try {
            name = resourceName(kind, parts, { uniqueIn });
          } catch (error) {
            // Only input with nothing the provider accepts may be refused.
            expect(String(error)).toContain(kind);
            return;
          }
          expect(nameViolations(kind, name)).toEqual([]);
          expect(resourceName(kind, parts, { uniqueIn })).toBe(name);
        }
      )
    );
  });

  test('a long name is cut to the provider limit with a hash of the whole', () => {
    const long = [
      'acme',
      'synthetic-population-worker',
      'development',
      'replica',
      'eu',
    ];
    const name = resourceName('grafana-uid', long);
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.endsWith(`-${stableHash(long.join('-'))}`)).toBe(true);
    // Two long names with the same prefix stay distinct.
    expect(resourceName('grafana-uid', [...long.slice(0, 4), 'us'])).not.toBe(
      name
    );
  });

  test('a globally unique name is scoped by a stable suffix, never a random one', () => {
    const a = resourceName('aws-s3-bucket', ['acme', 'state'], {
      uniqueIn: 'account-1',
    });
    expect(a).toBe(`acme-state-${stableHash('account-1')}`);
    expect(
      resourceName('aws-s3-bucket', ['acme', 'state'], {
        uniqueIn: 'account-2',
      })
    ).not.toBe(a);
  });
});

describe('stableHash', () => {
  test('is FNV-1a 64 over UTF-8, first eight hex digits', () => {
    // Published FNV-1a 64 test vectors: "" and "a".
    expect(stableHash('')).toBe('cbf29ce4');
    expect(stableHash('a')).toBe('af63dc4c');
  });
});
