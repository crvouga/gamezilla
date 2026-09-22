import { describe, expect, test } from 'bun:test';
import { getManifestVolume, soundManifest } from '@pkgs/sounds';

describe('sound volumes', () => {
  test('the volume table matches every manifest entry', () => {
    for (const entry of soundManifest) {
      expect({ id: entry.id, volume: getManifestVolume(entry.id) }).toEqual({
        id: entry.id,
        volume: entry.volume,
      });
    }
  });

  test('an unknown sound plays at full volume', () => {
    expect(getManifestVolume('not.a.sound')).toBe(1);
  });
});
