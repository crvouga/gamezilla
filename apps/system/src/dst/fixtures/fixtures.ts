/** Canonical actors / credentials for `@apps/system` DST scenarios. */

export const aliceCreds = {
  email: 'alice@sim.local',
  password: 'sim-password-123',
  username: 'alice',
} as const;

export const aliceUserCreds = {
  email: 'alice-user@sim.local',
  password: aliceCreds.password,
  username: 'alice_user',
} as const;

export const aliceAvatarCreds = {
  email: 'alice-avatar@sim.local',
  password: aliceCreds.password,
  username: 'alice_avatar',
} as const;

export const bobCreds = {
  email: 'bob@sim.local',
  password: aliceCreds.password,
  username: 'bob',
} as const;

/** Claimed usernames for the friends request/accept scenario. */
export const aliceUsername = 'alice' as const;
export const bobUsername = 'bob' as const;
