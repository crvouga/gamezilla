/**
 * Apple's server-to-server notifications, relying-party side.
 *
 * The body is `{"payload":"<JWT>"}`, signed with the id_token keys, `aud` =
 * our Services ID. Its `events` claim is a JSON **string** (tolerated as an
 * object too). `jti` identifies the delivery so a replay is applied once.
 */

import type { AppleProvider } from './apple-oauth';
import { claimString } from './provider-identity';

export const APPLE_NOTIFICATION_TYPES = [
  'consent-revoked',
  'account-delete',
  'email-disabled',
  'email-enabled',
] as const;

export type AppleNotificationType = (typeof APPLE_NOTIFICATION_TYPES)[number];

export type AppleNotification = {
  readonly jti: string;
  readonly type: AppleNotificationType;
  readonly sub: string;
  readonly email: string | null;
};

function parseEvents(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return raw !== null && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : null;
}

function notificationType(raw: unknown): AppleNotificationType | null {
  return APPLE_NOTIFICATION_TYPES.find((type) => type === raw) ?? null;
}

export async function verifyAppleNotification(
  apple: AppleProvider,
  payload: string
): Promise<AppleNotification> {
  const claims = await apple.verify(payload, {
    issuer: apple.config.issuer,
    audience: apple.config.clientId,
  });
  const events = parseEvents(claims['events']);
  const type = notificationType(events?.['type']);
  const sub = claimString(events?.['sub']);
  const jti = claimString(claims.jti);
  if (events === null || type === null || sub === null || jti === null) {
    throw new Error('apple notification malformed');
  }
  return { jti, type, sub, email: claimString(events['email']) };
}
