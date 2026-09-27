/**
 * What notifications contributes to a server: the inbox routes, mounted where
 * the inbox lives. What an inbox item *means* belongs to whichever feature
 * produced it; those register their own action handlers.
 */

import { defineFeatureServer } from '@libs/feature/public/server';
import { Hono } from 'hono';

import { createNotificationsSubApp } from './notifications-route';

export const NOTIFICATIONS_SERVER = defineFeatureServer({
  name: 'notifications',
  routes: (ctx) =>
    new Hono().route(
      '/notifications',
      createNotificationsSubApp(() => ctx.clock.now())
    ),
});
