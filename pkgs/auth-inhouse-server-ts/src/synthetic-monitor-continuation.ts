import { AUTH_OAUTH_STATE_TTL_MS } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { jwtVerify, SignJWT } from 'jose';
import type { AuthAppCtx } from './create-auth-app-types';

const ISSUER = 'synthetic-monitor-device';

function signingKey(ctx: AuthAppCtx): Uint8Array {
  const monitor = ctx.deps.syntheticMonitor;
  if (monitor === undefined)
    throw new Error('Synthetic monitoring is not configured');
  return new TextEncoder().encode(
    JSON.stringify([ISSUER, ctx.deps.secret, monitor.token])
  );
}

/** Only the runner receives this scoped capability; a fresh journey never supplies one. */
export function createMonitorContinuation(
  ctx: AuthAppCtx,
  userId: string,
  callbackUrl: string
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(callbackUrl)
    .setSubject(userId)
    .setExpirationTime(
      Math.floor((ctx.deps.clock.now() + AUTH_OAUTH_STATE_TTL_MS) / 1000)
    )
    .sign(signingKey(ctx));
}

export async function readMonitorContinuation(
  ctx: AuthAppCtx,
  token: string,
  callbackUrl: string
): Promise<string | null> {
  try {
    const verified = await jwtVerify(token, signingKey(ctx), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: callbackUrl,
      currentDate: new Date(ctx.deps.clock.now()),
      requiredClaims: ['sub', 'exp'],
    });
    return verified.payload.sub ?? null;
  } catch {
    return null;
  }
}
