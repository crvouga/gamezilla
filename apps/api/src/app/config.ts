import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';

export type ApiHandlerConfig = PatchDbApiConfig & {
  readonly secretStore: SecretStore;
};
