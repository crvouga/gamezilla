import { assert } from '@pkgs/assert';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';

import type { BearerTokenStore } from './bearer-token-store';
import type { BetterAuthReactClient } from './create-auth-client';

export const BETTER_AUTH_NETWORK_ERROR =
  'No internet connection. Connect and try again.';

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
  client: BetterAuthReactClient,
  mode: 'sign-in' | 'sign-up',
  email: string,
  password: string
): Promise<void> {
  if (mode === 'sign-up') {
    const result = await client.signUp.email({
      email,
      password,
      name: email,
    });
    if (result.error !== null && result.error !== undefined) {
      throwAuthClientError(result.error);
    }
    return;
  }
  const result = await client.signIn.email({ email, password });
  if (result.error !== null && result.error !== undefined) {
    throwAuthClientError(result.error);
  }
}

export async function runEmailPasswordSignIn(args: {
  readonly client: BetterAuthReactClient;
  readonly bearerStore: BearerTokenStore;
  readonly credentials: SignInCredentials;
  readonly hasUsableBearerSession: () => Promise<boolean>;
}): Promise<void> {
  const { client, bearerStore } = args;
  const email = args.credentials.email.trim();
  const password = args.credentials.password;
  assert.nonEmptyString(email, 'email is required');
  assert.nonEmptyString(password, 'password is required');

  if (await args.hasUsableBearerSession()) {
    return;
  }
  await bearerStore.clear();

  try {
    await callEmailAuth(
      client,
      args.credentials.mode ?? 'sign-in',
      email,
      password
    );
  } catch (error) {
    rethrowNetworkAware(error);
  }

  await client.getSession();
  const token = await bearerStore.read();
  if (token !== null) {
    await bearerStore.write(token);
  }
}
