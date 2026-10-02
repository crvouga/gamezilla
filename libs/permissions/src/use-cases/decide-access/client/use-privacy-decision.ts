import { useAuth } from '@libs/auth/public/use-auth';
import { useClock } from '@pkgs/clock/solid';
import type { Decision } from '@pkgs/permissions';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import { decidePrivacyAccess } from '../../../public/privacy-permission';

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
