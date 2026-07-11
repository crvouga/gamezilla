import manifestJson from './manifest.json';
import type { SoundManifest } from './manifest-types';

export const soundManifest = manifestJson as SoundManifest;

const manifestById = new Map(
  soundManifest.map((entry) => [entry.id, entry] as const)
);

export function getManifestEntry(id: string) {
  return manifestById.get(id);
}

export function getManifestVolume(id: string): number {
  return manifestById.get(id)?.volume ?? 1;
}
