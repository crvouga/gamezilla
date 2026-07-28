import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import { SpacesError } from '../shared/spaces-errors';
import { createFriendInvite, ensureLinkInvite } from './space-invite-service';
import { mapSpacesError, withSpacesSignedInAuth } from './spaces-route-auth';

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function handleEnsureLinkInvite(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withSpacesSignedInAuth(c, async (auth) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const spaceId = readOptionalString(body['spaceId']);
    if (spaceId === null) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'spaceId is required');
    }
    const sql = c.get('sqlClient');
    const invite = await ensureLinkInvite({
      sql,
      spaceId,
      accountId: auth.accountId,
      deviceId: auth.deviceId,
    });
    return c.json({ invite });
  });
}

export function handleCreateInvite(c: Context<ApiHonoEnv>): Promise<Response> {
  return withSpacesSignedInAuth(c, async (auth) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const spaceId = readOptionalString(body['spaceId']);
    const kind = readOptionalString(body['kind']);
    if (spaceId === null) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'spaceId is required');
    }
    const sql = c.get('sqlClient');
    if (kind === 'friend') {
      const inviteeAccountId = readOptionalString(body['inviteeAccountId']);
      if (inviteeAccountId === null) {
        throw new SpacesError(
          'SPACE_INVALID_INPUT',
          'inviteeAccountId is required'
        );
      }
      const invite = await createFriendInvite({
        sql,
        spaceId,
        accountId: auth.accountId,
        deviceId: auth.deviceId,
        inviteeAccountId,
      });
      return c.json({ invite });
    }
    if (kind === 'link' || kind === null) {
      const invite = await ensureLinkInvite({
        sql,
        spaceId,
        accountId: auth.accountId,
        deviceId: auth.deviceId,
      });
      return c.json({ invite });
    }
    throw new SpacesError('SPACE_INVALID_INPUT', 'Invalid invite kind');
  });
}

export { mapSpacesError };
