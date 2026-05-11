import { HOSTED_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import type { HostedAuthUiPort } from './ports';

/** Hosted sign-in needs a non-empty API origin (see `useConfigService().getApiUrl()`). */
export function deriveHostedAuthUiFromApiUrl(
  apiUrl: string | null | undefined
): HostedAuthUiPort {
  const trimmed = typeof apiUrl === 'string' ? apiUrl.trim() : '';
  const available = trimmed.length > 0;
  return {
    available,
    unavailableReason: available ? null : HOSTED_SIGN_IN_UNAVAILABLE_REASON,
  };
}
