import { createContext, type JSX, useContext } from 'solid-js';

export type SignInCapabilities = {
  readonly google: boolean;
  readonly devOauth: boolean;
  /**
   * False while sync paint is not ready or the local `client_config` watch has
   * not hydrated. Callers must not treat missing methods as “server has none
   * configured” until ready.
   */
  readonly ready: boolean;
};

const DEFAULT_SIGN_IN_CAPABILITIES: SignInCapabilities = {
  google: false,
  devOauth: false,
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
  return <Ctx.Provider value={props.value}>{props.children}</Ctx.Provider>;
}

export function useSignInCapabilities(): SignInCapabilities {
  return useContext(Ctx);
}
