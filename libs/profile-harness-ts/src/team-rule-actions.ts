import { scenarioAction } from '@libs/harness-ts/actor-ui';

/**
 * The team stops allowing `username`. Connected devices receive the rules;
 * disconnected devices retain their installed rules. The name stays saved.
 */
export const stopAllowingUsername = scenarioAction({
  name: 'stopAllowingUsername',
  act: async (s, username: string) => {
    s.harness.teamRules.stopAllowing('username', username);
    await s.session.waitForIdle();
  },
});

/** A release starts allowing `username` again. */
export const startAllowingUsername = scenarioAction({
  name: 'startAllowingUsername',
  act: async (s, username: string) => {
    s.harness.teamRules.startAllowing('username', username);
    await s.session.waitForIdle();
  },
});
