import type { AppAuthContext } from '@gamezilla/api/patch-db/abac-policies';

/** Authenticated PatchDB context: signed-in account UUID (not anonymous). */
export type AuthContext = AppAuthContext & { readonly accountId: string };
