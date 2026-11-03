import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useSpaceDecision } from '@libs/spaces-client-ts/use-space-decision';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { FramePeople } from './game-frame-view-types';
import {
  type GameHistoryRow,
  GameHistoryScreenView,
} from './game-history-screen-view';
import { useGameRecordLabel } from './game-record-label';
import { GameReplayScreenView } from './game-replay-screen-view';
import { type GameHistoryRecord, useGameRecords } from './use-game-records';

const PEOPLE: FramePeople = {
  name: (person) => <UserUsername profileId={person} withAt={false} />,
};

/** Replays one finished game on the game's own board, read-only. */
function RecordReview(props: {
  record: GameHistoryRecord;
  onBack: () => void;
}): JSX.Element {
  const recordLabel = useGameRecordLabel();
  const [ply, setPly] = createSignal(props.record.moves.length);
  const presentation = useGamePresentation();
  const myId = useMyId();
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
  return (
    <>
      <DefineBackButton onPress={props.onBack} />
      <GameReplayScreenView
        ply={ply()}
        moves={props.record.moves.length}
        label={recordLabel(props.record)}
        position={position()}
        onPrevious={() => setPly((n) => n - 1)}
        onNext={() => setPly((n) => n + 1)}
        board={
          <Dynamic
            component={presentation(position()).Board}
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
          />
        }
      />
    </>
  );
}

function AllowedGameHistory(props: {
  gameId: string;
  onBack: () => void;
}): JSX.Element {
  const model = useGameRecords(() => props.gameId);
  const recordLabel = useGameRecordLabel();
  const [selected, select] = createSignal<GameHistoryRecord | null>(null);
  const rows = createMemo((): readonly GameHistoryRow[] =>
    model.records().map((record) => ({
      id: record.id,
      players: record.participants.map((participant) => ({
        person: participant.person,
        plainName: '',
        bot: participant.bot,
        local: participant.local,
      })),
      label: recordLabel(record),
    }))
  );
  return (
    <Show
      when={selected()}
      keyed
      fallback={
        <>
          <DefineBackButton onPress={props.onBack} />
          <GameHistoryScreenView
            loading={model.isLoading()}
            statistics={model.statistics()}
            records={rows()}
            people={PEOPLE}
            onSelect={(id) =>
              select(model.records().find((record) => record.id === id) ?? null)
            }
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
