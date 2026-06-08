/**
 * Global namespace for every remote object-store key (Backblaze B2). The shared
 * bucket is partitioned per project; the B2 transport gate in `namespace-guard.ts`
 * rejects any S3 wire key that does not start with `gamezilla/`.
 */
export const ObjectStoreNamespace = {
  root: 'gamezilla/',
} as const;

export const ObjectStorePrefix = {
  ttsAudio: 'tts-audio/',
} as const;
