import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleCreateInvite,
  handleEnsureLinkInvite,
  handleJoinSpace,
  handlePeekSpace,
  handleRevokeInvite,
} from './spaces-route-handlers';

export function createSpacesApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .get('/spaces/:id/peek', handlePeekSpace)
    .post('/spaces/join', handleJoinSpace)
    .post('/spaces/invites', handleCreateInvite)
    .post('/spaces/invites/link', handleEnsureLinkInvite)
    .post('/spaces/invites/:id/revoke', handleRevokeInvite);
}
