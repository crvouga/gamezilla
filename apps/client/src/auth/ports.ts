/**
 * Provider-agnostic hosted auth contracts. Implementations live under `./clerk` (or future providers).
 */

export type HostedAuthState = {
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
};

export interface HostedSessionPort {
  getState(): HostedAuthState;
  getToken(): Promise<string | null>;
}

export interface HostedSignInPort {
  startSignIn(): Promise<void>;
  signOut(): Promise<void>;
}

export interface HostedAuthUiPort {
  available: boolean;
  unavailableReason: string | null;
}

export type HostedAuthPorts = {
  readonly session: HostedSessionPort;
  readonly signIn: HostedSignInPort;
  readonly ui: HostedAuthUiPort;
};
