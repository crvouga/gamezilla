import type { HostedSignInPort } from '../ports';

type AuthClientLike = {
  signIn: {
    social: (args: {
      provider: 'google';
      callbackURL: string;
    }) => Promise<unknown>;
  };
  signOut: () => Promise<unknown>;
};

export class HostedSignInBetterAuthAdapter implements HostedSignInPort {
  constructor(private readonly client: AuthClientLike) {}

  async startSignIn(): Promise<void> {
    const res = (await this.client.signIn.social({
      provider: 'google',
      callbackURL: '/sso-callback',
    })) as { error?: { message?: string } | null };
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Hosted sign-in failed');
    }
  }

  async signOut(): Promise<void> {
    await this.client.signOut();
  }
}
