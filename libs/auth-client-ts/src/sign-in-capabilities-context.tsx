import { createContext, type JSX, useContext } from 'solid-js';

export type SignInCapabilities = {
  readonly google: boolean;
  /** Sign in with Apple (non-production: backed by the simulated provider). */
  readonly apple: boolean;
  /**
   * Emailed sign-in links. Unlike the providers above this is never synced
   * server config: it comes from the device's own environment, and only a
   * Synthetic User's application host turns it on. A person's app never does.
   */
  readonly email: boolean;
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
  email: false,
  ready: true,
};

const Ctx = createContext<SignInCapabilities>(DEFAULT_SIGN_IN_CAPABILITIES);

/**
 * Optional integrations for the sign-in modal. Defaults to all off until a
 * parent provides values (providers from synced `client_config`, `email`
 * from the device's own environment).
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
    get email() {
      return props.value.email;
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
