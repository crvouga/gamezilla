import { CLERK_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import type { HostedAuthUiPort } from './ports';

/** Derives UI availability from synced client config (Clerk publishable key slot). */
export class HostedAuthUiFromPublishableKeyAdapter implements HostedAuthUiPort {
  readonly available: boolean;
  readonly unavailableReason: string | null;

  constructor(publishableKey: string | null | undefined) {
    const available =
      typeof publishableKey === 'string' && publishableKey.trim().length > 0;
    this.available = available;
    this.unavailableReason = available
      ? null
      : CLERK_SIGN_IN_UNAVAILABLE_REASON;
  }
}

export function deriveHostedAuthUiFromPublishableKey(
  publishableKey: string | null | undefined
): HostedAuthUiPort {
  return new HostedAuthUiFromPublishableKeyAdapter(publishableKey);
}
