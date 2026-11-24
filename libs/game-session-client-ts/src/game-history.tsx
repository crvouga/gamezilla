import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import {
  DefineBackButton,
  DefineSpaceTitle,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useSpaceDecision } from '@libs/spaces-client-ts/use-space-decision';
import { t } from '@lingui/core/macro';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { dynamic, type JSX } from '@solidjs/web';
import { createMemo, createSignal, Show, untrack } from 'solid-js';
import { frameSwatch } from './game-frame-look';
import type { FramePeople } from './game-frame-view-types';
import {
  type GameHistoryRow,
  GameHistoryScreenView,
} from './game-history-screen-view';
import { recordOutcome, useGameRecordEnding } from './game-record-label';
import {
  type GameReplayMove,
  type GameReplayPlayer,
  GameReplayScreenView,
} from './game-replay-screen-view';
import { type GameHistoryRecord, useGameRecords } from './use-game-records';

const PEOPLE: FramePeople = {
  name: (person) => <UserUsername profileId={person} withAt={false} />,
};

function historyPlayer(participant: GameHistoryRecord['participants'][number]) {
  return {
    person: participant.person,
    plainName: '',
    bot: participant.bot,
    local: participant.local,
  };
}

/**
 * Who made each move. Seats in rotation move in seat order from the first;
 * a game that names the next side itself (a trick's winner leads) or deals
 * hands names no mover, so its record numbers every move alone.
 */
function useReplayMoves() {
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  return (record: GameHistoryRecord): readonly GameReplayMove[] => {
    const turns = rules.turnsForPosition(record.position);
    const game = presentation(record.position);
    if (
      turns === undefined ||
      turns.turnOrder === 'rules' ||
      turns.hands !== undefined
    )
      return record.moves.map((move) => ({ label: move.label }));
    const seats = record.participants.map((participant) => ({
      sideLabel: game.sideLabel(participant.side),
      swatch: frameSwatch(game.frame.seats.look(participant.side)),
    }));
    return record.moves.map((move, index) => ({
      label: move.label,
      ...seats[index % seats.length],
    }));
  };
}

/** Replays one finished game on the game's own board, read-only. */
function RecordReview(props: {
  record: GameHistoryRecord;
  onBack: () => void;
}): JSX.Element {
  // The review opens on the record's last position: read once, so a record
  // read again from the device does not move the person off their place.
  const [ply, setPly] = createSignal(untrack(() => props.record.moves.length));
  const presentation = useGamePresentation();
  const replayMoves = useReplayMoves();
  const myId = useMyId();
  const game = () => presentation(props.record.position);
  // A game with a private setup faces the viewer's side, showing only their
  // own setup; every other game's review faces the first side as before.
  const side = () =>
    props.record.participants.find(
      (participant) => participant.person === myId()
    )?.side ?? 'white';
  const position = () =>
    ply() === 0
      ? (props.record.moves[0]?.before ?? props.record.position)
      : props.record.moves[ply() - 1]!.after;
  const players = createMemo((): readonly GameReplayPlayer[] =>
    props.record.participants.map((participant) => ({
      ...historyPlayer(participant),
      sideLabel: game().sideLabel(participant.side),
      swatch: frameSwatch(game().frame.seats.look(participant.side)),
      winner:
        props.record.result === 'won' &&
        props.record.winners.includes(participant.side),
      you: participant.person !== '' && participant.person === myId(),
    }))
  );
  const replay = createMemo(() => replayMoves(props.record));
  const Board = dynamic(() => presentation(position()).Board);
  return (
    <>
      <DefineBackButton onPress={props.onBack} label={t`Game history`} />
      <DefineSpaceTitle title={t`Game replay`} />
      <GameReplayScreenView
        players={players()}
        outcome={recordOutcome(props.record, myId())}
        endedAt={props.record.endedAt}
        ply={ply()}
        moves={replay()}
        moveHeading={game().moveHeading?.() ?? ''}
        position={position()}
        people={PEOPLE}
        onSeek={setPly}
        onBack={props.onBack}
        board={
          <Board
            position={position()}
            orientation={side()}
            interactive={false}
            sound={false}
            syncKey={0}
            onAction={() => {}}
            testId="game-history-board"
            setup={props.record.setup}
            hand={props.record.hand}
            committed={[]}
            commitment={null}
            steadyStatus
          />
        }
      />
    </>
  );
}

function AllowedGameHistory(props: {
  gameId: string;
  onBack: () => void;
  backLabel?: string | undefined;
}): JSX.Element {
  const model = useGameRecords(() => props.gameId);
  const recordEnding = useGameRecordEnding();
  const myId = useMyId();
  const [selected, select] = createSignal<GameHistoryRecord | null>(null);
  const choices = useGameChoicesName();
  const rows = createMemo((): readonly GameHistoryRow[] =>
    model.records().map((record) => {
      const outcome = recordOutcome(record, myId());
      return {
        id: record.id,
        // An unfilled place of a cancelled set-up is nobody to name.
        players: record.participants
          .filter(
            (participant) =>
              (outcome === null || participant.person !== myId()) &&
              (participant.person !== '' ||
                participant.bot ||
                participant.local)
          )
          .map(historyPlayer),
        outcome,
        // A watched game's row says who won and when; how is left to the replay.
        label:
          outcome === null && record.result === 'won'
            ? ''
            : recordEnding(record),
        winners:
          outcome === null && record.result === 'won'
            ? record.participants
                .filter((participant) =>
                  record.winners.includes(participant.side)
                )
                .map(historyPlayer)
            : [],
        endedAt: record.endedAt,
      };
    })
  );
  return (
    <Show
      when={selected()}
      keyed
      fallback={
        <>
          <DefineBackButton
            onPress={props.onBack}
            label={props.backLabel ?? choices()}
          />
          <DefineSpaceTitle title={t`Game history`} />
          <GameHistoryScreenView
            loading={model.isLoading()}
            statistics={model.statistics()}
            records={rows()}
            people={PEOPLE}
            onSelect={(id) =>
              select(model.records().find((record) => record.id === id) ?? null)
            }
            onPlay={props.onBack}
          />
        </>
      }
    >
      {(record) => <RecordReview record={record} onBack={() => select(null)} />}
    </Show>
  );
}

/** A game's History and stats: wires `GameHistoryScreenView` to the space. */
export function GameHistory(props: {
  gameId: string;
  onBack: () => void;
  /** Where Back leads, when it is not the game's choices. */
  backLabel?: string | undefined;
}): JSX.Element {
  const space = useSpaceRoomSessionId();
  const decision = useSpaceDecision(
    () => space() ?? '',
    PERMISSION.gameCustomWatch
  );
  return (
    <DecisionGate
      decision={decision()}
      testId="game-history-denial"
      denied={(denial) => (
        <GameHistoryScreenView
          denial={denial}
          loading={false}
          statistics={{ wins: 0, losses: 0, draws: 0 }}
          records={[]}
          onSelect={() => undefined}
        />
      )}
    >
      <AllowedGameHistory {...props} />
    </DecisionGate>
  );
}
