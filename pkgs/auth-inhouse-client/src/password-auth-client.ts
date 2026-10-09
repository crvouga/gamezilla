import { apiUrl, postJson } from './auth-client-http';
import type { SignInCtx } from './auth-client-oauth';
import { persistSessionFromResponse } from './auth-client-oauth';
import type { SignInOptions } from '@pkgs/auth-root-shared/auth-client-port';
import { isAuthErrorCode } from '@pkgs/auth-root-shared/auth-error-code';
import { AuthFlowError } from '@pkgs/auth-root-client/auth-flow-error';

export async function passwordAuthentication(
  ctx: SignInCtx,
  action: 'register' | 'sign-in',
  email: string,
  password: string,
  options: SignInOptions = {}
): Promise<void> {
  const response = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, `/auth/password/${action}`),
    { email, password, ...options }
  );
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    if (body.error !== undefined && isAuthErrorCode(body.error))
      throw new AuthFlowError(body.error);
    if (response.status === 429)
      throw new Error('Too many attempts. Try again later.');
    throw new Error(
      action === 'register'
        ? 'Registration could not be completed.'
        : 'The email address or password is incorrect.'
    );
  }
  await persistSessionFromResponse(ctx, response);
}
