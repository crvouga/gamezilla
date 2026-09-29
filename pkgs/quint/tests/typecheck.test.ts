import { describe, expect, test } from 'bun:test';
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
      const result = typecheck(join(FIXTURES, 'door-mistyped.qnt'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain("Couldn't unify str and int");
      expect(result.output).toContain('door-mistyped.qnt:6');
    },
    CLI_TIMEOUT_MS
  );
});
