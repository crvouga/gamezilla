import { describe, expect, test } from 'bun:test';
import { soundManifest } from '@pkgs/sounds-shared-ts/manifest';
import { isSoundId, Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import { soundAssetUrls } from '@pkgs/sounds-shared-ts/sound-urls';
import { getManifestVolume } from '@pkgs/sounds-shared-ts/sound-volumes';

describe('sound volumes', () => {
  test('the volume table matches every manifest entry', () => {
    for (const entry of soundManifest) {
      expect({ id: entry.id, volume: getManifestVolume(entry.id) }).toEqual({
        id: entry.id,
        volume: entry.volume,
      });
    }
  });

  // regression: generated-source-tracked
  test('generated sound IDs and URLs match the checked-in metadata', () => {
    expect(Object.values(Sounds).flatMap(Object.values).sort()).toEqual(
      soundManifest.map((entry) => entry.id).sort()
    );
    expect(Object.keys(soundAssetUrls).sort()).toEqual(
      soundManifest.map((entry) => entry.id).sort()
    );
    for (const entry of soundManifest) {
      expect(isSoundId(entry.id)).toBe(true);
      const url = soundAssetUrls[entry.id as keyof typeof soundAssetUrls];
      expect(decodeURI(url)).toEndWith(`/assets/${entry.filename}`);
    }
    expect(isSoundId('not.a.sound')).toBe(false);
  });

  test('an unknown sound plays at full volume', () => {
    expect(getManifestVolume('not.a.sound')).toBe(1);
  });
});
