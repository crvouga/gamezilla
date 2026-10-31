import { expect, test } from 'bun:test';
import { MultiplayerStatus } from '@libs/game-matchmaking-client-ts/multiplayer-status';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import {
  frameFixture,
  MATCH,
  renderMatchFrame,
  VIEWER,
} from './multiplayer-presentation-fixture';

const PEOPLE = { alice: 'Alice', bob: 'Bob', carol: 'Carol', dan: 'Dan' };
const FOUR_SEAT_MATCH: MultiplayerGame = {
  ...MATCH,
  black_id: 'bob',
  red_id: 'carol',
  blue_id: 'dan',
};

// regression: multiseat-frame-erases-turn-name
test('frame instructions retain the active person’s name for a four-seat listener', () => {
  const frame = frameFixture({
    turnStatus: () => 'South red circle to move. First to e5 wins.',
  });
  const view = renderMatchFrame(
    frame,
    () => (
      <MultiplayerStatus
        game={FOUR_SEAT_MATCH}
        viewer={{ ...VIEWER, myId: 'bob' }}
        winnerName="Alice"
        lowOnTime={null}
      />
    ),
    PEOPLE
  );
  const announcement = view.getByTestId('multiplayer-announcement');
  expect(announcement).toHaveTextContent("Alice's turn.");
  expect(announcement).toHaveTextContent(
    'South red circle to move. First to e5 wins.'
  );
});

test('four-seat named frame announcements track each active person for players and watchers', () => {
  assertProperty(
    'four-seat frame names survive changing turns',
    fc.property(
      fc.shuffledSubarray(['alice', 'bob', 'carol', 'dan'] as const, {
        minLength: 4,
        maxLength: 4,
      }),
      fc.constantFrom('alice', 'bob', 'carol', 'dan', 'watcher'),
      (turns, myId) => {
        const [game, setGame] = createSignal(FOUR_SEAT_MATCH);
        const frame = frameFixture({ turnStatus: () => 'Move toward e5.' });
        const view = renderMatchFrame(
          frame,
          () => (
            <MultiplayerStatus
              game={game()}
              viewer={{ ...VIEWER, myId, participant: myId !== 'watcher' }}
              winnerName="Alice"
              lowOnTime={null}
            />
          ),
          PEOPLE
        );
        const announcement = view.getByTestId('multiplayer-announcement');
        for (const turn of turns) {
          setGame({ ...FOUR_SEAT_MATCH, turn });
          expect(announcement).toHaveTextContent(`${PEOPLE[turn]}'s turn.`);
          expect(announcement).toHaveTextContent('Move toward e5.');
          for (const other of turns.filter((person) => person !== turn))
            expect(announcement).not.toHaveTextContent(
              `${PEOPLE[other]}'s turn.`
            );
        }
        setGame({
          ...FOUR_SEAT_MATCH,
          outcome: 'white',
          reason: 'resignation',
        });
        expect(announcement).toHaveTextContent(
          myId === 'alice'
            ? 'You won the multiplayer game.'
            : 'Alice won the multiplayer game.'
        );
        expect(announcement).not.toHaveTextContent("'s turn.");
        expect(announcement).not.toHaveTextContent('Move toward e5.');
        view.unmount();
      }
    )
  );
});

test('the live matched announcement includes the frame shot result and actual viewer', () => {
  // regression: matched-frame-turn-announcement-missing
  const [game, setGame] = createSignal<MultiplayerGame>(MATCH);
  const [viewer, setViewer] = createSignal(VIEWER);
  const frame = frameFixture({
    turnStatus: (position, side, committed) => {
      expect(committed).toEqual([]);
      return `${position}. C3 hit. Viewer: ${side ?? 'watcher'}.`;
    },
  });
  const view = renderMatchFrame(frame, () => (
    <MultiplayerStatus
      game={game()}
      viewer={viewer()}
      winnerName="Bob"
      lowOnTime={null}
    />
  ));
  const announcement = () => view.getByTestId('multiplayer-announcement');
  expect(announcement()).toHaveTextContent(
    'fixture:live. C3 hit. Viewer: white.'
  );
  expect(announcement()).toHaveTextContent('Matched with Bob');
  setGame({ ...MATCH, fen: 'fixture:next' });
  expect(announcement()).toHaveTextContent(
    'fixture:next. C3 hit. Viewer: white.'
  );
  setViewer({ ...VIEWER, myId: 'bob' });
  expect(announcement()).toHaveTextContent('Viewer: black.');
  setViewer({ ...VIEWER, myId: 'spectator', participant: false });
  expect(announcement()).toHaveTextContent('Watching multiplayer Fleet.');
  expect(announcement()).toHaveTextContent('Viewer: watcher.');
});

test('private setup and terminal outcomes retain their match headline', () => {
  const [game, setGame] = createSignal<MultiplayerGame>({
    ...MATCH,
    setup_ready: 'white',
  });
  const frame = frameFixture({ turnStatus: () => 'Fire at a square.' });
  const view = renderMatchFrame(frame, () => (
    <MultiplayerStatus
      game={game()}
      viewer={VIEWER}
      winnerName="Bob"
      lowOnTime={null}
    />
  ));
  expect(view.queryByText('Fire at a square.')).toBeNull();
  setGame({ ...MATCH, setup_ready: 'white,black' });
  expect(view.getByText('Fire at a square.')).toBeInTheDocument();
  setGame({ ...MATCH, outcome: 'black', reason: 'resignation' });
  expect(view.getByTestId('multiplayer-announcement')).toHaveTextContent(
    'Your opponent won the multiplayer game.'
  );
  expect(view.queryByText('Fire at a square.')).toBeNull();
  setGame({ ...MATCH, outcome: 'aborted' });
  expect(view.getByTestId('multiplayer-announcement')).toHaveTextContent(
    'The multiplayer game was aborted.'
  );
});

test('a game without a frame turn sentence keeps the generic turn headline', () => {
  const frame = frameFixture();
  const view = renderMatchFrame(frame, () => (
    <MultiplayerStatus
      game={MATCH}
      viewer={VIEWER}
      winnerName="Bob"
      lowOnTime={null}
    />
  ));
  expect(view.getByTestId('multiplayer-announcement')).toHaveTextContent(
    'Your turn.'
  );
});

test('live frame announcements track every new position and seat ownership', () => {
  assertProperty(
    'matched frame turn words',
    fc.property(
      fc.nat({ max: 10_000 }),
      fc.constantFrom('alice', 'bob', 'watcher'),
      (revision, myId) => {
        const [game, setGame] = createSignal<MultiplayerGame>(MATCH);
        const frame = frameFixture({
          turnStatus: (position, side) => `${position} / ${side ?? 'watcher'}`,
        });
        const viewer = { ...VIEWER, myId, participant: myId !== 'watcher' };
        const view = renderMatchFrame(frame, () => (
          <MultiplayerStatus
            game={game()}
            viewer={viewer}
            winnerName="Bob"
            lowOnTime={null}
          />
        ));
        const side =
          myId === 'alice' ? 'white' : myId === 'bob' ? 'black' : 'watcher';
        expect(view.getByTestId('multiplayer-announcement')).toHaveTextContent(
          `fixture:live / ${side}`
        );
        setGame({ ...MATCH, fen: `fixture:${revision}` });
        expect(view.getByTestId('multiplayer-announcement')).toHaveTextContent(
          `fixture:${revision} / ${side}`
        );
        view.unmount();
      }
    )
  );
});
