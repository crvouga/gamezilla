import type { useAuth, useSSO } from '@clerk/expo';

import type { ClerkSetActive } from './clerk-ensure-active-session';
import type { SsoFlowResult } from './clerk-sso-finalize';

export type ClerkStartBrowserSsoFlow = (params: {
  readonly redirectUrl: string;
  readonly oidcPrompt?: string;
}) => Promise<SsoFlowResult>;

export type ClerkAuthRuntime = {
  readonly startSSOFlow: ReturnType<typeof useSSO>['startSSOFlow'];
  /** Shared browser SSO (web same-tab redirect / native AuthSession). */
  readonly startBrowserSSOFlow: ClerkStartBrowserSsoFlow;
  /** Completes same-tab OAuth return via `rotating_token_nonce`. */
  readonly completeHostedAuthRedirect: () => Promise<void>;
  readonly signOut: ReturnType<typeof useAuth>['signOut'];
  readonly getToken: ReturnType<typeof useAuth>['getToken'];
  readonly setActive: ClerkSetActive;
  readonly ensureActiveSession: () => Promise<void>;
  readonly getActiveSessionId: () => string | null;
};

let runtime: ClerkAuthRuntime | null = null;

export function setClerkAuthRuntime(next: ClerkAuthRuntime | null): void {
  runtime = next;
}

export function getClerkAuthRuntime(): ClerkAuthRuntime | null {
  return runtime;
}
