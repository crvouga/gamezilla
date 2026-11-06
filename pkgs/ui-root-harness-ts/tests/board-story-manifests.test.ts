import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: board-story-manifest-authoring
test('board interaction stories expose usable generated contracts', () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../.cache/storybook/manifests/components.json', import.meta.url),
      'utf8'
    )
  ) as {
    components: Record<string, { stories: { id: string; error?: unknown }[] }>;
  };
  for (const [family, names] of [
    [
      'screens-games-battleship-board',
      ['fire-a-shot', 'hit-a-ship', 'sink-a-ship', 'sink-the-fleet'],
    ],
    [
      'screens-games-light-cycles-arena',
      [
        'steer-up',
        'duel-steering',
        'quad-steering',
        'shared-keyboard',
        'shared-swipe',
      ],
    ],
  ] as const) {
    for (const name of names) {
      const story = manifest.components[family]?.stories.find(
        (entry) => entry.id === `${family}--${name}`
      );
      expect(story).toBeDefined();
      expect(story?.error).toBeUndefined();
    }
  }
});
