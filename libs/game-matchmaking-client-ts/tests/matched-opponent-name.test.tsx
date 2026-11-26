import { expect, test } from 'bun:test';
import { MultiplayerSeat } from '@libs/game-matchmaking-client-ts/multiplayer-seat';
import { useMultiplayerViewer } from '@libs/game-matchmaking-client-ts/use-multiplayer-viewer';
import { createSignal, flush } from 'solid-js';
import {
  frameFixture,
  MATCH,
  renderMatchFrame,
} from './multiplayer-presentation-fixture';

function OpponentSeat() {
  const game = { ...MATCH, black_rating: '1500?' };
  const { viewer } = useMultiplayerViewer(
    () => game,
    () => 'alice'
  );
  return (
    <MultiplayerSeat
      game={game}
      position={game.fen}
      side="black"
      own={false}
      near={false}
      viewer={viewer()}
    />
  );
}

// regression: daily-opponent-label-before-profile
test.each(['CrazyGalliform967', 'MarriedKrill967'])(
  'the paired seat shows %s when the live profile arrives, then follows renaming and deletion',
  (name) => {
    const [username, setUsername] = createSignal<string | null>();
    const view = renderMatchFrame(frameFixture(), () => <OpponentSeat />, {
      get bob() {
        return username();
      },
    });
    const seat = view.getByTestId('multiplayer-opponent');
    expect(seat.textContent).toBe('Player (1500?)');
    setUsername(name);
    flush();
    expect(seat.textContent).toBe(`${name} (1500?)`);
    setUsername('bob_atlas');
    flush();
    expect(seat.textContent).toBe('bob_atlas (1500?)');
    setUsername(null);
    flush();
    expect(seat.textContent).toBe('Deleted account (1500?)');
    view.unmount();
  }
);
