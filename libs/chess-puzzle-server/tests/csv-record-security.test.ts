import { expect, test } from 'bun:test';
import { PuzzleRowIterator } from '@libs/chess-puzzle-server/puzzle-row-iterator';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

async function readRecord(value: string): Promise<Record<string, unknown>> {
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(store, 'input.csv', `__proto__,PuzzleId\n${value},a1\n`);
  const rows: Record<string, unknown>[] = [];
  await new PuzzleRowIterator().iterate(
    {
      store,
      key: 'input.csv',
      displayPath: 'input.csv',
      etag: '1',
      isZst: false,
    },
    async (row) => {
      rows.push(row);
      return true;
    }
  );
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

function assertOwnField(row: Record<string, unknown>, value: string): void {
  expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(row, '__proto__')?.value).toBe(value);
  expect(row['PuzzleId']).toBe('a1');
}

// regression: puzzle-csv-prototype-header
test('a literal __proto__ CSV column is an own field, not a prototype setter', async () => {
  for (const value of ['attacker', 'a']) {
    assertOwnField(await readRecord(value), value);
  }
});

test('prototype-named columns preserve arbitrary CSV cell text', async () => {
  await assertProperty(
    'CSV prototype column remains data',
    fc.asyncProperty(
      fc.array(fc.constantFrom('a', 'b', '0', '<', '>', '{', '}'), {
        minLength: 1,
        maxLength: 40,
      }),
      async (chars) => {
        const value = chars.join('');
        assertOwnField(await readRecord(value), value);
      }
    )
  );
});
