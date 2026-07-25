import type { SwitchAccountArgs } from '../use-switch-account';
import type { SyncBootReport } from './account-switch-boot-gate';
import { waitForTargetBootReady } from './account-switch-wait';

export type AccountSwitchRunTarget = {
  readonly sessionId: string;
  readonly accountId: string | null;
};

export type AccountSwitchRunDeps = {
  readonly switchAccount: (args: SwitchAccountArgs) => Promise<void>;
  readonly readBoot: () => SyncBootReport;
  readonly subscribeBoot: (onChange: () => void) => () => void;
};

/**
 * Runs account switch and waits until sync boot is ready for the target.
 * Warm pooled engines usually resolve immediately.
 */
export async function runAccountSwitch(
  target: AccountSwitchRunTarget,
  deps: AccountSwitchRunDeps
): Promise<void> {
  await deps.switchAccount({
    sessionId: target.sessionId,
    accountId: target.accountId,
  });
  await waitForTargetBootReady(
    target.accountId,
    deps.readBoot,
    deps.subscribeBoot
  );
}
