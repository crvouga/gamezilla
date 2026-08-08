import { assert } from '@pkgs/assert';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';

import {
  clearStoredBearerToken,
  readStoredBearerToken,
  writeStoredBearerToken,
} from './bearer-token-store';
import { getOrCreateBetterAuthReactClient } from './create-auth-client';
import { readAuthBaseURL } from './read-auth-base-url';

export const BETTER_AUTH_NETWORK_ERROR =
  'No internet connection. Connect and try again.';

function client() {
  return getOrCreateBetterAuthReactClient({ baseURL: readAuthBaseURL() });
}

function throwAuthClientError(error: unknown): never {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Sign-in failed';
  if (/network|fetch|offline/i.test(message)) {
    throw new Error(BETTER_AUTH_NETWORK_ERROR);
  }
  throw new Error(message);
}

function rethrowNetworkAware(error: unknown): never {
  if (error instanceof Error && error.message === BETTER_AUTH_NETWORK_ERROR) {
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/network|fetch|offline/i.test(message)) {
    throw new Error(BETTER_AUTH_NETWORK_ERROR);
  }
  throw error instanceof Error ? error : new Error(message);
}

async function callEmailAuth(
  mode: 'sign-in' | 'sign-up',
  email: string,
  password: string
): Promise<void> {
  if (mode === 'sign-up') {
    const result = await client().signUp.email({
      email,
      password,
      name: email,
    });
    if (result.error !== null && result.error !== undefined) {
      throwAuthClientError(result.error);
    }
    return;
  }
  const result = await client().signIn.email({ email, password });
  if (result.error !== null && result.error !== undefined) {
    throwAuthClientError(result.error);
  }
}

export async function runEmailPasswordSignIn(args: {
  readonly credentials: SignInCredentials;
  readonly hasUsableBearerSession: () => Promise<boolean>;
}): Promise<void> {
  const email = args.credentials.email.trim();
  const password = args.credentials.password;
  assert.nonEmptyString(email, 'email is required');
  assert.nonEmptyString(password, 'password is required');

  if (await args.hasUsableBearerSession()) {
    return;
  }
  await clearStoredBearerToken();

  try {
    await callEmailAuth(args.credentials.mode ?? 'sign-in', email, password);
  } catch (error) {
    rethrowNetworkAware(error);
  }

  await client().getSession();
  const token = await readStoredBearerToken();
  if (token !== null) {
    await writeStoredBearerToken(token);
  }
}
