import manifestJson from './manifest.json';
import type { SoundManifest } from './manifest-types';

/**
 * Full sound metadata (licenses, attributions, sources). Nothing on the play
 * path reads it — volume lives in `sound-volumes.ts` — so keep this module
 * free of top-level work and the JSON stays out of any bundle that does not
 * ask for it.
 */
export const soundManifest = manifestJson as SoundManifest;

export function getManifestEntry(id: string) {
  return soundManifest.find((entry) => entry.id === id);
}
