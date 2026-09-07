/** Canonical actors / credentials for `@apps/product` system scenarios. */

export const aliceCreds = {
  subject: 'alice',
} as const;

export const aliceUserCreds = {
  subject: 'alice_user',
} as const;

export const aliceAvatarCreds = {
  subject: 'alice_avatar',
} as const;

export const bobCreds = {
  subject: 'bob',
} as const;

/** Claimed usernames for the friends request/accept scenario. */
export const aliceUsername = 'alice' as const;
export const bobUsername = 'bob' as const;
