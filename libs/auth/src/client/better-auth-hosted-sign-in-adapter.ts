import type { HostedSignInPort } from './ports';

type AuthClientLike = {
  signIn: {
    social: (args: {
      provider: 'google';
      callbackURL: string;
    }) => Promise<unknown>;
  };
  signOut: () => Promise<unknown>;
};

type SignInSocialResult = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function resolveCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}

function navigateIfRedirectUrl(res: SignInSocialResult): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  if (typeof window === 'undefined') return;
  if (window.location.href === url) return;
  window.location.href = url;
}

export class HostedSignInBetterAuthAdapter implements HostedSignInPort {
  constructor(private readonly client: AuthClientLike) {}

  async startSignIn(): Promise<void> {
    const callbackURL = resolveCallbackUrl();
    const res = (await this.client.signIn.social({
      provider: 'google',
      callbackURL,
    })) as SignInSocialResult;
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Hosted sign-in failed');
    }
    navigateIfRedirectUrl(res);
  }

  async signOut(): Promise<void> {
    await this.client.signOut();
  }
}
