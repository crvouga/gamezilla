import type { AccountSwitchPhase } from './account-switch-context';

/** Whether the global account-switch transition surface should mount. */
export function isAccountSwitchSurfaceVisible(
  phase: AccountSwitchPhase
): boolean {
  return phase === 'loading' || phase === 'success' || phase === 'error';
}
