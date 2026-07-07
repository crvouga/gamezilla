/** Public profile fields resolved from the auth provider. */
export type AuthUserProfile = {
  readonly externalUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
};
