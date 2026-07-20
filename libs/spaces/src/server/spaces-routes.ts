import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleCreateInvite,
  handleEnsureLinkInvite,
} from './spaces-route-handlers';

/**
 * Remaining REST (absolute exceptions):
 * - invites: mint/ensure tokens (server RNG + denyAll upload)
 *
 * Join and peek are local-first via PowerSync (`space_join` stream +
 * `joinSpaceWrite` upload). Inbox accept still uses server join orchestration.
 */
export function createSpacesApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .post('/spaces/invites', handleCreateInvite)
    .post('/spaces/invites/link', handleEnsureLinkInvite);
}
