import type { useAuth, useSSO } from '@clerk/expo';

import type { ClerkSetActive } from './clerk-ensure-active-session';

export type ClerkAuthRuntime = {
  readonly startSSOFlow: ReturnType<typeof useSSO>['startSSOFlow'];
  readonly signOut: ReturnType<typeof useAuth>['signOut'];
  readonly getToken: ReturnType<typeof useAuth>['getToken'];
  readonly setActive: ClerkSetActive;
  readonly ensureActiveSession: () => Promise<void>;
};

let runtime: ClerkAuthRuntime | null = null;

export function setClerkAuthRuntime(next: ClerkAuthRuntime | null): void {
  runtime = next;
}

export function getClerkAuthRuntime(): ClerkAuthRuntime | null {
  return runtime;
}
