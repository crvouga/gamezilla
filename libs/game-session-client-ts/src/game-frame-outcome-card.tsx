import { t } from '@lingui/core/macro';
import {
  GameResultCard,
  type GameResultCardProps,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { FrameResultView } from './game-frame-result-view';
import type { FrameResult } from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps;

/** How the game went for the viewer, from the standings alone. */
function frameResultTone(
  result: FrameResult | null
): GameResultCardProps['tone'] {
  const standings = result?.standings ?? [];
  const own = standings.find((standing) => standing.you);
  if (own === undefined) return 'neutral';
  const first = standings.filter((standing) => standing.place === 1);
  if (standings.length > 1 && first.length === standings.length) return 'drawn';
  return own.place === 1 ? 'won' : 'lost';
}

/** Every seat shares first place: a draw, whoever reads it. */
function drawn(result: Props['result']): boolean {
  const standings = result?.standings ?? [];
  return (
    standings.length > 1 && standings.every((standing) => standing.place === 1)
  );
}

/**
 * Over the headline, one word for how the game went, as a matched game's
 * result says it: Victory, Defeat, Draw or Cancelled.
 */
function eyebrow(props: Props): string | undefined {
  if (props.phase === 'cancelled') return t`Cancelled`;
  if (props.result === null) return undefined;
  const tone = frameResultTone(props.result);
  if (tone === 'won') return t`Victory`;
  if (tone === 'lost') return t`Defeat`;
  if (drawn(props.result)) return t`Draw`;
  // Not "Game over": the dialog's own title already says that.
  return t`Final result`;
}

/**
 * Under the headline: how the game ended (`Black wins by resignation.`),
 * then the game's note (`Host starts the rematch.`), which says why
 * someone has no Rematch of their own.
 */
/**
 * Two players' scores in the result's own sentence ("You 19, jordan 26."),
 * so a phone's short card says them without the standings rows.
 */
function scoreLine(result: Props['result']): string {
  const rows = result?.standings ?? [];
  const [first, second] = rows;
  if (rows.length !== 2 || !first || !second) return '';
  if (first.score === null || second.score === null) return '';
  const name = (row: typeof first): string => (row.you ? t`You` : row.name);
  return t`${name(first)} ${first.score}, ${name(second)} ${second.score}.`;
}

/** Why the game ended: a cancelled game's, a draw's cause, else the status line's. */
function outcomeReason(props: Props): string {
  if (props.phase === 'cancelled')
    return t`Nobody won; the game was stopped before it finished.`;
  if (props.result === null) return '';
  const description = props.status?.description ?? '';
  if (!drawn(props.result)) return description;
  // The headline says it was drawn; the bare "Game drawn." is not repeated.
  if (props.result.reason) return props.result.reason;
  return /^game drawn\.?$/i.test(description.trim()) ? '' : description;
}

function outcomeCaption(props: Props): string | undefined {
  const note = props.result?.note ?? '';
  const caption = [outcomeReason(props), scoreLine(props.result), note]
    .filter((part) => part !== '')
    .join(' ');
  return caption === '' ? undefined : caption;
}

/**
 * How the game ended, beside the final board (under it on a phone, heading
 * the rail beside a wide one), never over it: the whole final position
 * stays in view. A phone folds the standings behind their own control.
 */
export function FrameOutcomeCard(props: Props): JSX.Element {
  const tone = () => frameResultTone(props.result);
  // Past tense, no full stop, as a matched game's result headline.
  const title = (): string =>
    props.result?.headline ??
    (props.phase === 'cancelled'
      ? t`The game was cancelled`
      : (props.status?.description ?? t`Game finished`));
  return (
    <GameResultCard
      tone={tone()}
      eyebrow={eyebrow(props)}
      title={title()}
      caption={outcomeCaption(props)}
      titleDataSet={{ testid: 'game-session-result-headline' }}
      dataSet={{ testid: 'game-session-outcome' }}
    >
      <Show when={props.result}>
        {(result) => (
          <FrameResultView result={result()} people={props.people} />
        )}
      </Show>
    </GameResultCard>
  );
}
