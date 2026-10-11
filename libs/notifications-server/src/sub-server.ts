/**
 * What notifications contributes to a server: the inbox routes, mounted where
 * the inbox lives. What an inbox item *means* belongs to whichever sub
 * produced it; those register their own action handlers.
 */

import { defineSubServer } from '@libs/sub-shared/server';
import { Hono } from 'hono';

import { createNotificationsSubApp } from './notifications-route';

export const NOTIFICATIONS_SERVER = defineSubServer({
  name: 'notifications',
  routes: (ctx) =>
    new Hono().route(
      '/notifications',
      createNotificationsSubApp(() => ctx.clock.now())
    ),
});
