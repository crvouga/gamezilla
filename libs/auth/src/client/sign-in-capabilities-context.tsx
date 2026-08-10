import { createContext, type ReactNode, useContext } from 'react';

export type SignInCapabilities = {
  readonly google: boolean;
  readonly emailPassword: boolean;
};

const DEFAULT_SIGN_IN_CAPABILITIES: SignInCapabilities = {
  google: false,
  emailPassword: false,
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
