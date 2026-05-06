import type { HostedSignInPort } from './ports';

export class HostedSignInStaticAdapter implements HostedSignInPort {
  readonly #startSignIn: HostedSignInPort['startSignIn'];
  readonly #signOut: HostedSignInPort['signOut'];

  constructor(args: {
    startSignIn: HostedSignInPort['startSignIn'];
    signOut: HostedSignInPort['signOut'];
  }) {
    this.#startSignIn = args.startSignIn;
    this.#signOut = args.signOut;
  }

  async startSignIn(): Promise<void> {
    await this.#startSignIn();
  }

  async signOut(): Promise<void> {
    await this.#signOut();
  }
}

