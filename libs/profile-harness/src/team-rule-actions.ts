import { scenarioAction } from '@libs/harness/actor-ui';

/**
 * The team stops allowing `username`. The rules ship with the app, so every
 * device and API instance has them at once, connected or not; whoever holds
 * the name keeps it.
 */
export const stopAllowingUsername = scenarioAction({
  name: 'stopAllowingUsername',
  act: async (s, username: string) => {
    s.harness.teamRules.stopAllowing('username', username);
    await s.session.waitForIdle();
  },
});

/** The team starts allowing `username` again, everywhere at once. */
export const startAllowingUsername = scenarioAction({
  name: 'startAllowingUsername',
  act: async (s, username: string) => {
    s.harness.teamRules.startAllowing('username', username);
    await s.session.waitForIdle();
  },
});
