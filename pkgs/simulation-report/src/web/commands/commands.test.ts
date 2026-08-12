import { describe, expect, test } from 'bun:test';

import type { Command } from './types';

describe('command filtering', () => {
  test('when() gates availability', () => {
    const cmds: Command[] = [
      {
        id: 'a',
        label: 'A',
        section: 'General',
        when: () => false,
        run: () => undefined,
      },
      {
        id: 'b',
        label: 'B',
        section: 'General',
        when: () => true,
        run: () => undefined,
      },
    ];
    const visible = cmds.filter((c) => !c.when || c.when());
    expect(visible.map((c) => c.id)).toEqual(['b']);
  });
});
