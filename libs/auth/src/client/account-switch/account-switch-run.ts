import type { SwitchAccountArgs } from '../use-switch-account';
import type { SyncBootReport } from './account-switch-boot-gate';
import {
  ACCOUNT_SWITCH_MIN_LOADING_MS,
  ACCOUNT_SWITCH_SUCCESS_HOLD_MS,
  delay,
  remainingMs,
} from './account-switch-timing';
import { waitForTargetBootReady } from './account-switch-wait';

export type AccountSwitchRunTarget = {
  readonly sessionId: string;
  readonly accountId: string | null;
};

export type AccountSwitchRunDeps = {
  readonly switchAccount: (args: SwitchAccountArgs) => Promise<void>;
  readonly readBoot: () => SyncBootReport;
  readonly subscribeBoot: (onChange: () => void) => () => void;
  readonly onPhase: (phase: 'loading' | 'success') => void;
};

/**
 * Runs Clerk switch + waits for target sync boot, then min-hold and success hold.
 * Caller owns error UI; this throws on failure.
 */
export async function runAccountSwitch(
  target: AccountSwitchRunTarget,
  deps: AccountSwitchRunDeps
): Promise<void> {
  deps.onPhase('loading');
  const startedAt = Date.now();
  await deps.switchAccount({
    sessionId: target.sessionId,
    accountId: target.accountId,
  });
  await waitForTargetBootReady(
    target.accountId,
    deps.readBoot,
    deps.subscribeBoot
  );
  await delay(remainingMs(startedAt, ACCOUNT_SWITCH_MIN_LOADING_MS));
  deps.onPhase('success');
  await delay(ACCOUNT_SWITCH_SUCCESS_HOLD_MS);
}
