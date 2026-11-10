import { OBSERVATORY_PATH } from '@libs/observatory-shared-ts/observatory-routes';
import { defineSubClient } from '@libs/sub-client-ts/client';
import { lazy } from 'solid-js';
import { LiveSessionReporter } from './live-session-reporter';
import { ObservatorySettings } from './observatory-settings';

/**
 * The User Observatory and every app's online-now report: whoever is online
 * now, people and Synthetic Users, and watching any of them live.
 */
export const OBSERVATORY_CLIENT = defineSubClient({
  name: 'observatory',
  settings: ObservatorySettings,
  // Every app reports that it is online now, a person's or a Synthetic User's.
  session: LiveSessionReporter,
  routes: [
    {
      path: OBSERVATORY_PATH,
      component: lazy(async () => ({
        default: (await import('./user-observatory-screen'))
          .UserObservatoryScreen,
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
