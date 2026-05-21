import type { R2Bucket } from '@gamezilla/object-store/impl-r2';
import type { SecretStore } from '@gamezilla/secret-store';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
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
