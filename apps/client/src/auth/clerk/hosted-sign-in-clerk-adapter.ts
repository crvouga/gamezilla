import type { HostedSignInPort } from '../ports';

export class HostedSignInClerkAdapter implements HostedSignInPort {
  readonly #start: () => Promise<void>;
  readonly #signOut: () => Promise<void>;

  constructor(args: { start: () => Promise<void>; signOut: () => Promise<void> }) {
    this.#start = args.start;
    this.#signOut = args.signOut;
  }

  async startSignIn(): Promise<void> {
    await this.#start();
  }

  async signOut(): Promise<void> {
    await this.#signOut();
  }
}

