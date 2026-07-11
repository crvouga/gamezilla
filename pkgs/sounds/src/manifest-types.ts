export type SoundManifestEntry = {
  readonly id: string;
  readonly category: string;
  readonly filename: string;
  readonly durationMs: number;
  readonly tags: readonly string[];
  readonly volume: number;
  readonly license: string;
  readonly attribution: string;
  readonly sourceUrl: string;
  readonly sourceFile: string;
  readonly intendedUsage: string;
  readonly status: 'active' | 'planned';
};

export type SoundManifest = readonly SoundManifestEntry[];
