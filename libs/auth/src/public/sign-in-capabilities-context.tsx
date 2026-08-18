import { createContext, type ReactNode, useContext } from 'react';

export type SignInCapabilities = {
  readonly google: boolean;
  readonly emailPassword: boolean;
  /**
   * False while sync paint is not ready or the local `client_config` watch has
   * not hydrated. Callers must not treat missing methods as “server has none
   * configured” until ready.
   */
  readonly ready: boolean;
};

const DEFAULT_SIGN_IN_CAPABILITIES: SignInCapabilities = {
  google: false,
  emailPassword: false,
  ready: true,
};

const Ctx = createContext<SignInCapabilities>(DEFAULT_SIGN_IN_CAPABILITIES);

/**
 * Optional integrations for the sign-in modal. Defaults to all off until a
 * parent provides values (typically from synced `client_config`).
 */
export function SignInCapabilitiesProvider({
  value,
  children,
}: {
  readonly value: SignInCapabilities;
  readonly children: ReactNode;
}): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSignInCapabilities(): SignInCapabilities {
  return useContext(Ctx);
}
