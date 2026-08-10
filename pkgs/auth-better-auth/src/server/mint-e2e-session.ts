import type { BetterAuthInstance } from './create-better-auth';

const E2E_PASSWORD = 'e2e-better-auth-password-ok';

export type MintE2eSessionResult = {
  readonly token: string;
  readonly userId: string;
  readonly email: string;
};

/**
 * Dev-only helper: ensure an email/password user exists and return a bearer
 * session token for Playwright injection.
 */
export async function mintE2eSession(args: {
  readonly auth: BetterAuthInstance;
  readonly email: string;
}): Promise<MintE2eSessionResult> {
  const email = args.email.trim().toLowerCase();
  if (email.length === 0 || !email.includes('@')) {
    throw new Error('mintE2eSession: email must be a non-empty address');
  }

  const signUp = await args.auth.api.signUpEmail({
    body: {
      email,
      password: E2E_PASSWORD,
      name: email.split('@')[0] ?? 'e2e',
    },
    asResponse: true,
  });

  let response = signUp;
  if (!response.ok) {
    response = await args.auth.api.signInEmail({
      body: { email, password: E2E_PASSWORD },
      asResponse: true,
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `mintE2eSession failed (${String(response.status)}): ${body}`
    );
  }

  const token = response.headers.get('set-auth-token')?.trim() ?? '';
  if (token.length === 0) {
    throw new Error('mintE2eSession: missing set-auth-token header');
  }

  const session = await args.auth.api.getSession({
    headers: new Headers({ Authorization: `Bearer ${token}` }),
  });
  if (session === null) {
    throw new Error('mintE2eSession: session not readable after mint');
  }

  return {
    token,
    userId: session.user.id,
    email: session.user.email,
  };
}
