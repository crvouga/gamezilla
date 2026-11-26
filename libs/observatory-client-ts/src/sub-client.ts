import {
  OBSERVATORY_PATH,
  ONLINE_NOW_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { defineSubClient } from '@libs/sub-client-ts/client';
import { lazy } from 'solid-js';

/**
 * The User Observatory: a hub linking to
 * Online now (whoever is online now, people and Synthetic Users, as a table)
 * and watching any of them live.
 */
export const OBSERVATORY_CLIENT = defineSubClient({
  name: 'observatory',
  routes: [
    {
      path: OBSERVATORY_PATH,
      component: lazy(async () => ({
        default: (await import('./user-observatory-screen'))
          .UserObservatoryScreen,
      })),
    },
    {
      path: ONLINE_NOW_PATH,
      component: lazy(async () => ({
        default: (await import('./online-now-screen')).OnlineNowScreen,
      })),
    },
    {
      path: `${OBSERVATORY_PATH}/live/:sessionId`,
      component: lazy(async () => ({
        default: (await import('./live-watch-screen')).LiveWatchScreen,
      })),
    },
  ],
});
