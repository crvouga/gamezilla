import { t } from '@lingui/core/macro';
import {
  GameResultCard,
  type GameResultCardProps,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/** How the matched game ended, as the result card says it. */
export type MultiplayerResultShown = {
  readonly tone: GameResultCardProps['tone'];
  /** The game was aborted: there is no result. */
  readonly aborted?: boolean | undefined;
  /** The game was drawn, whoever reads it (a watcher's tone is neutral). */
  readonly drawn?: boolean | undefined;
  /** Who won, in a sentence. */
  readonly title: JSX.Element;
  /** Why, and an offered rematch. */
  readonly caption?: JSX.Element | undefined;
  /** What the game did to the person's rating: its own row, under the why. */
  readonly rating?: JSX.Element | undefined;
};

/**
 * Over the card's headline, one word: how the game went for the person,
 * as a custom game's result says it (Victory, Defeat, Draw, Aborted).
 */
function headline(result: MultiplayerResultShown): string {
  if (result.aborted === true) return t`Aborted`;
  if (result.tone === 'won') return t`Victory`;
  if (result.tone === 'lost') return t`Defeat`;
  if (result.tone === 'drawn' || result.drawn === true) return t`Draw`;
  // Not "Game over": the dialog's own title already says that.
  return t`Final result`;
}

/**
 * How the matched game ended, beside the final board (under it on a
 * phone, heading the rail beside a wide one), never over it: the word, the
 * sentence, why and the rating change, then where else it leads. It is the
 * screen's announcement of how the game ended.
 */
export function MultiplayerResultCard(props: {
  readonly result: MultiplayerResultShown | undefined;
  /** Under the result: where else it leads. */
  readonly children?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Show when={props.result}>
      {(result) => (
        <GameResultCard
          live
          tone={result().tone}
          // Every outcome opens with its word, a draw's too, as a custom
          // game's result does.
          // The outcome's word, and what it did to the rating beside it on
          // the same line, so the card stays short over the board.
          eyebrow={
            <StackHorizontal align="center" gap="sm">
              {headline(result())}
              {result().rating}
            </StackHorizontal>
          }
          title={result().title}
          caption={result().caption}
          dataSet={{ testid: 'multiplayer-announcement' }}
        >
          {props.children}
        </GameResultCard>
      )}
    </Show>
  );
}
