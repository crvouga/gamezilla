import { expect, test } from 'bun:test';
import { ContentGameProvider } from '@libs/game-puzzle-client-ts/content-game-context';
import { usePuzzleLibraryNavigation } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { createComponent, createRoot } from 'solid-js';

// regression: word-tiles-puzzle-unreadable-no-destination
test('the public board navigation action opens the existing library without reading or changing puzzle state', () => {
  const destinations: unknown[] = [];
  let navigate: () => void = () => {
    throw new Error('Navigation was not composed');
  };
  const dispose = createRoot((cleanup) => {
    createComponent(ContentGameProvider, {
      value: {
        id: 'example',
        title: 'Example',
        get content(): never {
          throw new Error('Navigation must not alter content');
        },
        get client(): never {
          throw new Error('Navigation must not render another player');
        },
        get catalog(): never {
          throw new Error('Navigation must not choose another puzzle');
        },
        open: (destination) => destinations.push(destination),
      },
      get children() {
        navigate = usePuzzleLibraryNavigation();
        return null;
      },
    });
    return cleanup;
  });
  try {
    expect(destinations).toEqual([]);
    navigate();
    expect(destinations).toEqual([{ kind: 'library' }]);
  } finally {
    dispose();
  }
});
