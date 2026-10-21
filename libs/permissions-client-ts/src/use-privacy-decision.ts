import { useAuth } from '@libs/auth-client-ts/auth-client-provider';
import { decidePrivacyAccess } from '@libs/permissions-shared-ts/privacy-permission';
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';

export function usePrivacyDecision(): (
  action: string,
  decision: Decision
) => Decision {
  const auth = useAuth();
  const clock = useClock();
  const engine = useSyncEngine();
  return (action, decision) =>
    decidePrivacyAccess(decision, {
      action,
      connected: engine.status().online,
      authenticatedAtMs: auth.session?.authenticatedAt?.getTime() ?? null,
      nowMs: clock.now(),
    });
}
