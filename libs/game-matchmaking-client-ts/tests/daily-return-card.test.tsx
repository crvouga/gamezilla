import { expect, mock, test } from 'bun:test';
import { ReturnOffer } from '@libs/game-matchmaking-client-ts/return-to-game-offer';
import { fireEvent } from '@solidjs/testing-library';
import {
  frameFixture,
  renderMatchFrame,
} from './multiplayer-presentation-fixture';

test.each([true, false])(
  'the daily game names the player to move and opens the match (my turn %p)',
  (myTurn) => {
    const open = mock(() => undefined);
    const view = renderMatchFrame(
      frameFixture(),
      () => (
        <ReturnOffer
          game={{
            kind: 'matched',
            gameId: 'words',
            href: '/games/words',
            daily: {
              game: 'Word Tiles',
              myTurn,
              playerId: 'bob',
              lastMove: 'AERIE h8 10',
              figures: 'Score 0 – 10',
            },
          }}
          placement="inline"
          finishFirst={false}
          onReturn={open}
        />
      ),
      { bob: 'Robin' }
    );
    const card = view.getByTestId('return-to-game');
    expect(card.textContent).toContain(
      myTurn ? 'Word Tiles with Robin' : 'Waiting for Robin'
    );
    expect(card.textContent).toContain(myTurn ? 'Your move' : 'Word Tiles');
    expect(card.textContent).toContain('Score 0 – 10');
    expect(card.textContent).toContain('Last move: AERIE h8 10');
    fireEvent.click(
      view.getByRole('button', { name: 'Return to your matched game' })
    );
    expect(open).toHaveBeenCalledTimes(1);
    view.unmount();
  }
);
