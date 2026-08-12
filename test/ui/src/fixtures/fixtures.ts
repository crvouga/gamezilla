/** Canonical actors / credentials for `@test/ui` scenarios. */

export const aliceCreds = {
  email: 'alice@sim.local',
  password: 'sim-password-123',
} as const;

export const aliceUserCreds = {
  email: 'alice-user@sim.local',
  password: aliceCreds.password,
} as const;

export const aliceAvatarCreds = {
  email: 'alice-avatar@sim.local',
  password: aliceCreds.password,
} as const;
