import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import type { Decision } from '@pkgs/permissions';
import { useRouter } from '@pkgs/ui';

import {
  unlockCtaLabel,
  unlockCtaRoute,
} from '../use-cases/decide-access/client/unlock-copy';
import { usePermissions } from './use-permissions';

/** What a denial unlocks, as policy config names it (`unlockRefs`). */
export type Unlock = {
  /** The decision's CTA label, or undefined when its denial unlocks nothing. */
  readonly label: (decision: Decision) => string | undefined;
  /** Runs the decision's CTA; a no-op when it has none. */
  readonly run: (decision: Decision) => void;
};

/**
 * Turns a denial into its configured way forward. Callers hand over the
 * decision and never learn what the CTA is — signing in, seeing plans or
 * anything config adds later — so no feature branches on why it was denied.
 */
export function useUnlock(): Unlock {
  const permissions = usePermissions();
  const signIn = useSignInModal();
  const router = useRouter();
  const target = (decision: Decision): string | undefined =>
    permissions.unlock(decision)?.ctaTarget;
  return {
    label: (decision) => unlockCtaLabel(target(decision)),
    run: (decision) => {
      const cta = target(decision);
      if (cta === undefined) return;
      if (cta === 'signup') {
        signIn.open();
        return;
      }
      const route = unlockCtaRoute(cta);
      if (route !== undefined) router.push(route);
    },
  };
}
