import type { AppAuthContext } from '@gamezilla/patch-db/abac/app-auth-context';

/** Authenticated PatchDB context: signed-in account UUID (not anonymous). */
export type AuthContext = AppAuthContext & { readonly accountId: string };
