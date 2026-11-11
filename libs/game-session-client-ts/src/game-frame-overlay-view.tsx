import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { StageOverlayPhase } from '@pkgs/turn-game-client-ts/stage-overlay';
import {
  GAME_VERSUS_AVATAR_SIZE,
  GameResultOverlay,
  type GameResultOverlayProps,
  GameVersusOverlay,
  type GameVersusSide,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import { FrameResultView } from './game-frame-result-view';
import type { FramePlaceProps } from './game-frame-screen-view';
import type {
  FramePeople,
  FramePhase,
  FramePlaySeat,
  FrameResult,
} from './game-frame-view-types';

type Props = FramePlaceProps;

/** Where the game stands, as its board's overlay cares. */
export function frameOverlayPhase(phase: FramePhase): StageOverlayPhase {
  if (phase === 'active') return 'play';
  if (phase === 'none') return 'unknown';
  return phase === 'configuring' ? 'setup' : 'over';
}

/** How the game went for the viewer, from the standings alone. */
export function frameResultTone(
  result: FrameResult | null
): GameResultOverlayProps['tone'] {
  const standings = result?.standings ?? [];
  const own = standings.find((standing) => standing.you);
  if (own === undefined) return 'neutral';
  const first = standings.filter((standing) => standing.place === 1);
  if (standings.length > 1 && first.length === standings.length) return 'drawn';
  return own.place === 1 ? 'won' : 'lost';
}

function versusSide(
  seat: FramePlaySeat,
  people: FramePeople | undefined
): GameVersusSide {
  return {
    id: seat.side,
    name: (
      <FrameHolderName
        holder={seat.holder}
        plainName={seat.plainName}
        people={people}
      />
    ),
    avatar: (
      <FrameHolderAvatar
        holder={seat.holder}
        plainName={seat.plainName}
        size={GAME_VERSUS_AVATAR_SIZE}
        people={people}
      />
    ),
    swatch: seat.swatch,
    caption: seat.sideLabel,
  };
}

/**
 * The two bands of the versus card: the viewer's own seat below and the
 * rest above; a watched table is split in two, in seat order.
 */
function versusBands(props: Props): {
  readonly others: readonly GameVersusSide[];
  readonly own: readonly GameVersusSide[];
} {
  const side = (seat: FramePlaySeat) => versusSide(seat, props.people);
  const { near, others } = props.table;
  if (near !== null) return { others: others.map(side), own: [side(near)] };
  const half = Math.ceil(others.length / 2);
  return {
    others: others.slice(0, half).map(side),
    own: others.slice(half).map(side),
  };
}

function FrameVersusOverlay(
  props: Props & { readonly count: number }
): JSX.Element {
  const bands = () => versusBands(props);
  return (
    <GameVersusOverlay
      others={bands().others}
      own={bands().own}
      mark={<Trans>VS</Trans>}
      count={props.count}
      countLabel={<Trans>Starts in</Trans>}
      skipLabel={<Trans>Start now</Trans>}
      aria-label={
        props.status === null
          ? t`The game is starting.`
          : t`${props.status.lineup} The game is starting.`
      }
      onSkip={() => props.onOverlay({ type: 'skip' })}
      dataSet={{ testid: 'custom-game-versus', count: String(props.count) }}
    />
  );
}

function eyebrow(tone: GameResultOverlayProps['tone']): string {
  if (tone === 'won') return t`Victory`;
  if (tone === 'lost') return t`Defeat`;
  if (tone === 'drawn') return t`Draw`;
  return t`Game over`;
}

/**
 * Under the headline: how the game ended (`Black wins by resignation.`),
 * then the game's own note.
 */
function outcomeCaption(props: Props): string | undefined {
  const reason = props.result === null ? '' : (props.status?.description ?? '');
  const note = props.result?.note ?? '';
  const caption = [reason, note].filter((part) => part !== '').join(' ');
  return caption === '' ? undefined : caption;
}

function FrameOutcomeOverlay(props: Props): JSX.Element {
  const tone = () => frameResultTone(props.result);
  return (
    <GameResultOverlay
      tone={tone()}
      eyebrow={props.result === null ? undefined : eyebrow(tone())}
      title={
        props.result?.headline ?? props.status?.description ?? t`Game finished`
      }
      caption={outcomeCaption(props)}
      dismissLabel={t`Show the board`}
      onDismiss={() => props.onOverlay({ type: 'dismiss' })}
      titleDataSet={{ testid: 'custom-game-result-headline' }}
      dataSet={{ testid: 'custom-game-outcome' }}
    >
      <Show when={props.result}>
        {(result) => (
          <FrameResultView result={result()} people={props.people} />
        )}
      </Show>
    </GameResultOverlay>
  );
}

/**
 * What lies over the board, as the stage's overlay machine says
 * (`StageOverlay`): the versus card and its count while a game this device
 * watched begin starts, the result card once it is over, else nothing.
 */
export function FrameOverlay(props: Props): JSX.Element {
  return (
    <Switch>
      <Match when={props.overlay.kind === 'versus' ? props.overlay : null}>
        {(versus) => <FrameVersusOverlay {...props} count={versus().count} />}
      </Match>
      <Match when={props.overlay.kind === 'outcome'}>
        <FrameOutcomeOverlay {...props} />
      </Match>
    </Switch>
  );
}
