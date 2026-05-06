import type { HostedAuthState, HostedSessionPort } from '../ports';

export class HostedSessionClerkAdapter implements HostedSessionPort {
  readonly #getState: () => HostedAuthState;
  readonly #getToken: () => Promise<string | null>;

  constructor(args: { getState: () => HostedAuthState; getToken: () => Promise<string | null> }) {
    this.#getState = args.getState;
    this.#getToken = args.getToken;
  }

  getState(): HostedAuthState {
    return this.#getState();
  }

  async getToken(): Promise<string | null> {
    return await this.#getToken();
  }
}

