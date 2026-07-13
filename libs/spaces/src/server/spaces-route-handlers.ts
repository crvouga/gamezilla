import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import { SpacesError } from '../shared/spaces-errors';
import { joinSpaceServer } from './space-join-service';
import {
  createFriendInvite,
  ensureLinkInvite,
  revokeSpaceInvite,
} from './space-invite-service';
import { buildSpacePeek } from './space-peek';
import {
  mapSpacesError,
  withSpacesDeviceAuth,
  withSpacesSignedInAuth,
} from './spaces-route-auth';

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function handlePeekSpace(c: Context<ApiHonoEnv>): Promise<Response> {
  return withSpacesDeviceAuth(c, async (auth) => {
    const spaceId = c.req.param('id');
    if (typeof spaceId !== 'string' || spaceId.length === 0) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'space id is required');
    }
    const invite = readOptionalString(c.req.query('invite'));
    const sql = c.get('sqlClient');
    const peek = await buildSpacePeek({
      sql,
      spaceId,
      viewerDeviceId: auth.deviceId,
      viewerAccountId: auth.accountId,
      inviteToken: invite,
    });
    return c.json({ peek });
  });
}

export function handleJoinSpace(c: Context<ApiHonoEnv>): Promise<Response> {
  return withSpacesDeviceAuth(c, async (auth) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const spaceId = readOptionalString(body['spaceId']);
    const deviceLabel = readOptionalString(body['deviceLabel']);
    if (spaceId === null) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'spaceId is required');
    }
    if (deviceLabel === null) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'deviceLabel is required');
    }
    const sql = c.get('sqlClient');
    await joinSpaceServer(sql, {
      spaceId,
      deviceId: auth.deviceId,
      accountId: auth.accountId,
      profileId: auth.myId,
      deviceLabel,
      inviteToken: readOptionalString(body['inviteToken']),
    });
    return c.json({ ok: true });
  });
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

export function handleRevokeInvite(c: Context<ApiHonoEnv>): Promise<Response> {
  return withSpacesSignedInAuth(c, async (auth) => {
    const inviteId = c.req.param('id');
    if (typeof inviteId !== 'string' || inviteId.length === 0) {
      throw new SpacesError('SPACE_INVALID_INPUT', 'invite id is required');
    }
    const sql = c.get('sqlClient');
    await revokeSpaceInvite({
      sql,
      inviteId,
      accountId: auth.accountId,
      deviceId: auth.deviceId,
    });
    return c.json({ ok: true });
  });
}

export { mapSpacesError };
