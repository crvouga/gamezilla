import type { R2Bucket } from '@gamezilla/lib/object-store/impl-r2';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  readonly pubSub: PatchDbApiConfig['pubSub'];
  readonly basePath?: string;
  readonly instrumentation?: PatchDbApiConfig['instrumentation'];
  /**
   * R2 bucket for cached TTS audio. When omitted, the TTS sub-app is not
   * mounted (handy for local dev when ElevenLabs is not set up).
   */
  readonly ttsAudioBucket?: R2Bucket;
};
