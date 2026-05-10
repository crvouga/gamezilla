import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  readonly pubSub: PatchDbApiConfig['pubSub'];
  readonly basePath?: string;
  readonly instrumentation?: PatchDbApiConfig['instrumentation'];
};
