import { useAuth } from '@libs/auth-client/auth-client-provider';
import { useClock } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { decidePrivacyAccess } from '@libs/permissions-shared/privacy-permission';

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
