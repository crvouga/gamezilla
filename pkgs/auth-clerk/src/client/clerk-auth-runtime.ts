import type { useAuth, useSSO } from '@clerk/expo';

import type { ClerkSetActive } from './clerk-ensure-active-session';
import type { SsoFlowResult } from './clerk-sso-finalize';

export type ClerkRuntimeSession = {
  readonly id: string;
  readonly userId: string | null;
  readonly email: string | null;
};

export type ClerkStartAddAccountSsoFlow = (params: {
  readonly strategy: string;
  readonly redirectUrl: string;
}) => Promise<SsoFlowResult>;

export type ClerkAuthRuntime = {
  readonly startSSOFlow: ReturnType<typeof useSSO>['startSSOFlow'];
  readonly startAddAccountSSOFlow: ClerkStartAddAccountSsoFlow;
  readonly signOut: ReturnType<typeof useAuth>['signOut'];
  readonly getToken: ReturnType<typeof useAuth>['getToken'];
  readonly setActive: ClerkSetActive;
  readonly ensureActiveSession: () => Promise<void>;
  readonly getActiveSessionId: () => string | null;
  /** Live `clerk.client.sessions` (not a stale React snapshot). */
  readonly listSessions: () => readonly ClerkRuntimeSession[];
};

let runtime: ClerkAuthRuntime | null = null;

export function setClerkAuthRuntime(next: ClerkAuthRuntime | null): void {
  runtime = next;
}

export function getClerkAuthRuntime(): ClerkAuthRuntime | null {
  return runtime;
}
