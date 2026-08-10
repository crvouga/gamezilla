import { describe, expect, it } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';

import { createSpaceOpenRoomsPending } from './space-open-rooms-pending';

describe('createSpaceOpenRoomsPending', () => {
  it('flushes enqueued payloads in order when a room becomes available', () => {
    const pending = createSpaceOpenRoomsPending();
    const seen: string[] = [];
    pending.enqueue('s1', {
      type: asKeyword('games-cmd/select-game'),
      payload: { game: 'chess' },
    });
    pending.enqueue('s1', {
      type: asKeyword('games-cmd/select-game'),
      payload: { game: null },
    });
    pending.flush('s1', (p) => {
      seen.push(String((p.payload as { game: string | null }).game));
    });
    expect(seen).toEqual(['chess', 'null']);
    pending.flush('s1', () => {
      throw new Error('should be empty');
    });
  });

  it('clear drops buffered commands for that space', () => {
    const pending = createSpaceOpenRoomsPending();
    pending.enqueue('s1', {
      type: asKeyword('games-cmd/select-game'),
      payload: { game: 'chess' },
    });
    pending.clear('s1');
    let flushed = 0;
    pending.flush('s1', () => {
      flushed += 1;
    });
    expect(flushed).toBe(0);
  });
});
