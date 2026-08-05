import { describe, expect, test } from 'bun:test';

import type { AccountSwitchPhase } from './account-switch-context';
import { isAccountSwitchSurfaceVisible } from './account-switch-surface-visibility';

describe('isAccountSwitchSurfaceVisible', () => {
  const cases: ReadonlyArray<{
    phase: AccountSwitchPhase;
    visible: boolean;
  }> = [
    { phase: 'idle', visible: false },
    { phase: 'loading', visible: true },
    { phase: 'success', visible: true },
    { phase: 'error', visible: true },
  ];

  for (const { phase, visible } of cases) {
    test(`${phase} → ${visible ? 'shown' : 'hidden'}`, () => {
      expect(isAccountSwitchSurfaceVisible(phase)).toBe(visible);
    });
  }
});
