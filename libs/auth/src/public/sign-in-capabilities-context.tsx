import { createContext, type JSX, useContext } from 'solid-js';

export type SignInCapabilities = {
  readonly google: boolean;
  /** Sign in with Apple (non-production: backed by the simulated provider). */
  readonly apple: boolean;
  /**
   * False while sync paint is not ready or the local `client_config` watch has
   * not hydrated. Callers must not treat missing methods as “server has none
   * configured” until ready.
   */
  readonly ready: boolean;
};

const DEFAULT_SIGN_IN_CAPABILITIES: SignInCapabilities = {
  google: false,
  apple: false,
  ready: true,
};

const Ctx = createContext<SignInCapabilities>(DEFAULT_SIGN_IN_CAPABILITIES);

/**
 * Optional integrations for the sign-in modal. Defaults to all off until a
 * parent provides values (typically from synced `client_config`).
 */
export function SignInCapabilitiesProvider(props: {
  readonly value: SignInCapabilities;
  readonly children: JSX.Element;
}): JSX.Element {
  const value: SignInCapabilities = {
    get google() {
      return props.value.google;
    },
    get apple() {
      return props.value.apple;
    },
    get ready() {
      return props.value.ready;
    },
  };
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useSignInCapabilities(): SignInCapabilities {
  return useContext(Ctx);
}
