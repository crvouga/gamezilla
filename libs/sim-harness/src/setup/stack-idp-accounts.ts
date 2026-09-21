/**
 * A stack's simulated Google keeps its own account directory. The person
 * behind each actor needs an account there before they can sign in — the
 * in-process fabric adds one to its IdP node; a stack gets it through the
 * provider's test-only control plane.
 */
import { IDP_ADMIN_PREFIX } from '@pkgs/idp-google-sim/shared';

export async function ensureStackIdpAccount(args: {
  readonly idpOrigin: string;
  readonly actorId: string;
  readonly email: string;
}): Promise<void> {
  const { idpOrigin, actorId, email } = args;
  const response = await fetch(`${idpOrigin}${IDP_ADMIN_PREFIX}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: actorId, email }),
  });
  if (!response.ok) {
    throw new Error(
      `stack IdP: adding ${actorId} failed (${String(response.status)}: ${await response.text()})`
    );
  }
}
