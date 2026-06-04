import type { R2Bucket } from '@pkgs/object-store/impl-r2';
import type { SecretStore } from '@pkgs/secret-store';
import type { PatchDbApiConfig } from '@pkgs/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  /** When set, overrides Doppler `API_URL` for Better Auth (preview / QA). */
  readonly apiUrlOverride?: string | null;
  readonly pubSub: PatchDbApiConfig['pubSub'];
  readonly basePath?: string;
  readonly instrumentation?: PatchDbApiConfig['instrumentation'];
  /**
   * R2 bucket for cached TTS audio. Required: the TTS sub-app is mounted
   * unconditionally and `createTtsAppFromBindings` asserts this binding
   * is present.
   */
  readonly ttsAudioBucket: R2Bucket;
};
