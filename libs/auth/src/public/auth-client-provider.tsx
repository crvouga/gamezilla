import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { defineContext } from '@pkgs/solid-context/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import type { JSX, ParentProps } from 'solid-js';

export type { AuthClientPort };

const AuthClientPortContext = defineContext<AuthClientPort>('AuthClientPort');

export function AuthClientProvider(
  props: ParentProps<{ readonly port: AuthClientPort }>
): JSX.Element {
  // Composition-root DI: the port identity is fixed for this tree's lifetime.
  // oxlint-disable-next-line solid/reactivity -- intentional one-time DI capture
  const staticPort = props.port;
  return (
    <AuthClientPortContext.Provider value={staticPort}>
      {props.children}
    </AuthClientPortContext.Provider>
  );
}

export function useAuthClientPort(): AuthClientPort {
  return AuthClientPortContext.use();
}

/** Live provider session. Keep the object intact; its properties are tracked. */
export function useAuth(): AuthSessionState {
  const snapshot = createSubscriptionSignal(useAuthClientPort().session);
  return {
    get isHydrated() {
      return snapshot().isHydrated;
    },
    get session() {
      return snapshot().session;
    },
    get error() {
      return snapshot().error;
    },
  };
}
