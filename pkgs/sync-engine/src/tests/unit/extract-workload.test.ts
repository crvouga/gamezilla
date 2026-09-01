import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { defineQuery, extractWorkload, queryRegistry } from '../../shared';

describe('extractWorkload', () => {
  test('captures statements deterministically', async () => {
    const q = defineQuery({
      name: 'toy',
      async run(ctx) {
        const rows = await ctx.db.query(
          sql`SELECT id FROM notes WHERE user_id = ${ctx.env.actorId}`
        );
        return { notes: rows };
      },
    });
    const registry = queryRegistry([q]);
    const a = await extractWorkload(registry);
    const b = await extractWorkload(registry);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.queries).toHaveLength(1);
    expect(a.queries[0]!.statements).toHaveLength(1);
    expect(a.queries[0]!.statements[0]!.sql.toLowerCase()).toContain('user_id');
  });

  test('fails on zero-statement query', async () => {
    const q = defineQuery({
      name: 'empty',
      async run() {
        return { notes: [] };
      },
    });
    await expect(extractWorkload(queryRegistry([q]))).rejects.toThrow(
      /zero statements/
    );
  });
});
