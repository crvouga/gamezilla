import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';

export type ApiHandlerConfig = PatchDbApiConfig & {
  /** Google OAuth Web client ID; optional audience check on id_token. */
  googleClientId?: string;
};
