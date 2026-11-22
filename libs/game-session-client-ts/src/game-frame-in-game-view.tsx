import { useSpaceScreenChrome } from '@libs/spaces-client-ts/space-screen-chrome';
import { ClaimSpaceShell } from '@libs/spaces-client-ts/space-shell-claim';
import { t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type { SpaceInGameAside } from '@pkgs/ui-root-client-ts/space-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show } from 'solid-js';
import { FrameBoard } from './game-frame-board-seat';
import {
  frameInGameResult,
  frameLiveActions,
  frameStandingActions,
} from './game-frame-in-game-actions';
import {
  frameHolders,
  frameSeatSources,
  sameHolders,
} from './game-frame-in-game-seats';
import { FrameMovesCard } from './game-frame-moves-view';
import type { FramePlaceProps } from './game-frame-screen-view';
import {
  captionLine,
  FrameConnectionView,
  FrameErrorView,
  FramePlayNoticesView,
} from './game-frame-status-view';
import { FrameVersusView } from './game-frame-versus-view';
import { spaceGameOf, spaceGamePeople, spaceGamePlay } from './space-game-of';

type Props = FramePlaceProps;

/** The game is over, or was called off. */
function over(props: Props): boolean {
  return props.phase === 'completed' || props.phase === 'cancelled';
}

/** The game's engine stopped, in words; `''` while it runs. */
function stoppedText(props: Props): string {
  return props.stopped
    ? t`The game stopped. Your last saved score is kept. Reopen the game to try again.`
    : '';
}

/**
 * Under row 1: the space's own notice, then the connection, a refused
 * choice, and what a player is told during play (a draw offered, an
 * opponent away). Nothing while there is none of it.
 */
function FrameInGameNotices(props: Props): JSX.Element {
  const play = (): boolean => props.phase === 'active';
  const shown = (): boolean =>
    props.connection !== 'online' ||
    props.error !== '' ||
    props.stopped ||
    (play() && (props.play.drawOffered || props.play.away !== null));
  return (
    <>
      {props.spaceNotice}
      <Show when={shown()}>
        <StackVertical gap="sm" paddingX="lg" paddingTop="sm">
          <FrameConnectionView connection={props.connection} />
          <FrameErrorView
            text={props.error === '' ? stoppedText(props) : props.error}
          />
          <Show when={play()}>
            <FramePlayNoticesView play={props.play} people={props.people} />
          </Show>
        </StackVertical>
      </Show>
    </>
  );
}

/**
 * The board edge to edge in the stage, its public state for automated
 * observers (`custom-game-public`), and the side drawn nearest the viewer.
 */
function FrameInGameBoard(props: Props): JSX.Element {
  const near = (): Record<string, string> => {
    const side = props.table.near?.side ?? props.table.others[0]?.side;
    return side === undefined ? {} : { near: side };
  };
  return (
    <GameBoardStage
      viewportFit={props.boardFit}
      align={props.boardAlign}
      dataSet={{
        ...props.boardState,
        ...near(),
        testid: 'custom-game-public',
        overlay: props.overlay.kind,
      }}
    >
      <FrameBoard
        table={props.table}
        people={props.people}
        viewerSide={props.viewerSide}
        board={props.board}
      />
    </GameBoardStage>
  );
}

/** Behind the status line: the moves played, and the space's history. */
function FrameInGameAside(props: Props): JSX.Element {
  return (
    <StackVertical gap="lg">
      <FrameMovesCard {...props} />
      <Show when={props.record?.history}>
        <Button
          title={<Trans>History and stats</Trans>}
          variant="outline"
          intent="neutral"
          fullWidth
          onClick={() => props.onOpenHistory()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
    </StackVertical>
  );
}

/** The game's facts beside the status line: `Unrated · 10+5`. */
function factsLine(props: Props): string | undefined {
  const status = props.status;
  if (status === null) return undefined;
  const clock =
    status.minutes > 0 ? `${status.minutes}+${status.increment}` : t`Untimed`;
  return `${t`Unrated`} · ${clock}`;
}

function useAside(props: Props) {
  const opens = createMemo(() => {
    const record = props.record;
    if (record === null || (!record.turns && !record.history)) return null;
    return record.turns ? 'moves' : 'history';
  });
  return createMemo((): SpaceInGameAside | undefined => {
    const kind = opens();
    if (kind === null) return undefined;
    return {
      label: kind === 'moves' ? t`Moves` : t`History`,
      testId: 'custom-game-commands',
      content: () => <FrameInGameAside {...props} />,
    };
  });
}

/**
 * The custom game while it is played and once it is over, in the space's
 * in-game template: row 1 the space's own actions, row 2 everyone in the
 * space with each player's color, turn and one figure, the board edge to
 * edge, and the live actions for this moment by the thumbs. The viewer's
 * standing actions (Offer draw, Resign, Cancel game) join the bar while it
 * has room, else open from the viewer's own cell. The versus card counts
 * in over the stage; the outcome and what comes next replace the status
 * line and the actions once the game is over. The moves and the history
 * open from the status line.
 */
export function FrameInGamePlace(props: Props): JSX.Element {
  const chrome = useSpaceScreenChrome();
  const { i18n } = useLingui();
  const board = <FrameInGameBoard {...props} />;
  const holders = createMemo(
    () => frameHolders(props.table, props.viewerSide),
    [],
    { equals: sameHolders }
  );
  const people = createMemo(() =>
    spaceGamePeople(chrome.people, holders(), 'custom-game-you')
  );
  const play = createMemo(() =>
    spaceGamePlay({
      status: props.status === null ? '' : captionLine(props.status),
      detail: factsLine(props),
      board,
      waiting:
        props.viewerSide === null
          ? t`You're watching. Moves appear as they are played.`
          : undefined,
      seats: frameSeatSources(props.table, props.result, i18n().locale),
      actions: over(props) ? [] : frameLiveActions(props),
      standing: over(props) ? [] : frameStandingActions(props),
    })
  );
  const game = createMemo(() => ({
    ...spaceGameOf({
      ...props.identity,
      players: { min: props.playerCount, max: props.playerCount },
      bots: false,
    }),
    play: play(),
  }));
  const aside = useAside(props);
  return (
    <>
      <ClaimSpaceShell />
      <SpaceInGameTemplate
        spaceName={chrome.spaceName}
        role={chrome.role}
        onBack={chrome.onBack}
        backLabel={chrome.backLabel}
        menu={chrome.menu}
        onLeave={chrome.onLeave}
        onEnd={chrome.onEnd}
        testIds={chrome.testIds}
        onPersonAction={chrome.onPersonAction}
        personCapabilities={chrome.personCapabilities}
        notice={<FrameInGameNotices {...props} />}
        game={game()}
        people={people()}
        overlay={<FrameVersusView {...props} />}
        result={over(props) ? frameInGameResult(props) : undefined}
        aside={aside()}
        moreTestId="custom-game-more"
        statusTestId="custom-game-status"
        lineup={props.status?.lineup}
        dataSet={{
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
      />
    </>
  );
}
