import { expect, test } from 'bun:test';
import { normalizePgPhysical } from '@pkgs/db-schema-root-shared-ts/type-map';

// regression: matchmaking-postgres-real-type-rejected
// Real Postgres reports the internal UDT name float8 for DOUBLE PRECISION.
test('a declared real matches its Postgres catalog type without a false migration', () => {
  expect(normalizePgPhysical('float8')).toBe(
    normalizePgPhysical('double precision')
  );
  expect(normalizePgPhysical('float4')).not.toBe(
    normalizePgPhysical('double precision')
  );
});
