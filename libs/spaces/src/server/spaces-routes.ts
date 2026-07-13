import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleCreateInvite,
  handleEnsureLinkInvite,
  handleJoinSpace,
  handlePeekSpace,
} from './spaces-route-handlers';

/**
 * Remaining REST (temporary for invite / cross-scope cases):
 * - peek: when local space row is missing or invite token must be validated
 * - join: fallback when local authorize lacks invite/friendship rows
 * - invites: mint/ensure tokens (server RNG + denyAll upload)
 */
export function createSpacesApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .get('/spaces/:id/peek', handlePeekSpace)
    .post('/spaces/join', handleJoinSpace)
    .post('/spaces/invites', handleCreateInvite)
    .post('/spaces/invites/link', handleEnsureLinkInvite);
}
