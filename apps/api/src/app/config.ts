import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SecretStore } from '@pkgs/secret-store';
import type { PatchDbApiConfig } from '@pkgs/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  /** When set, overrides Doppler `API_URL` for Better Auth (preview / QA). */
  readonly apiUrlOverride?: string | null;
  readonly pubSub: PatchDbApiConfig['pubSub'];
  readonly basePath?: string;
  readonly instrumentation?: PatchDbApiConfig['instrumentation'];
  readonly objectStore: ObjectStore;
};
