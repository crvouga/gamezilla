import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typecheck } from '@pkgs/quint/typecheck';

const FIXTURES = join(import.meta.dir, 'fixtures');

/** Each check spawns the Quint CLI: ~0.5 s idle, seconds under a loaded gate. */
const CLI_TIMEOUT_MS = 30_000;

describe('typecheck', () => {
  test(
    'a well-typed model checks',
    () => {
      expect(typecheck(join(FIXTURES, 'door.qnt'))).toEqual({ ok: true });
    },
    CLI_TIMEOUT_MS
  );

  test(
    'a model with a type error fails, naming the line',
    () => {
      const file = join(FIXTURES, 'door-mistyped.qnt');
      const result = typecheck(file);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain("Couldn't unify str and int");
      const line =
        readFileSync(file, 'utf8')
          .split('\n')
          .findIndex((source) => source.includes('action step')) + 1;
      expect(result.output).toContain(`door-mistyped.qnt:${String(line)}`);
    },
    CLI_TIMEOUT_MS
  );
});
