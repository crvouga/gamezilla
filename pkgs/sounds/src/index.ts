// Chess board sounds: import `@pkgs/sounds/chess-sound-urls` only from chess —
// keep them off the shell `@pkgs/sounds` barrel (module graph / preload).
export { getManifestEntry, getManifestVolume, soundManifest } from './manifest';
export type { SoundManifest, SoundManifestEntry } from './manifest-types';
export {
  createPlayFromStart,
  type PlayableAudioPlayer,
  type PlayFromStartHandle,
} from './play-from-start';
export {
  isAutoplayBlockedError,
  isReleasedSharedObjectError,
  playAudioOrIgnoreAutoplayBlock,
} from './safe-audio-play';
export {
  createSoundEngine,
  type PlaySoundOptions,
  type SoundEngine,
} from './sound-engine';
export { isSoundId, type SoundId, Sounds } from './sound-id';
export { type SoundAssetUrlId, soundAssetUrls } from './sound-urls';
