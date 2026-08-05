import type { AccountSwitchPhase } from './account-switch-context';

export type SwitchChrome = {
  phase: Exclude<AccountSwitchPhase, 'idle'>;
  error: Error | null;
  pendingDisplayTitle: string | null;
};

/**
 * Keep the last non-idle chrome while the surface fades out after dismiss
 * (phase is already `idle`). Without this the exit frame is blank.
 */
export function latchSwitchChrome(
  previous: SwitchChrome | null,
  phase: AccountSwitchPhase,
  error: Error | null,
  pendingDisplayTitle: string | null
): SwitchChrome | null {
  if (phase === 'idle') return previous;
  return { phase, error, pendingDisplayTitle };
}
