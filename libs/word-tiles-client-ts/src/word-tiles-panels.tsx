import { WORD_TILES_SEATS } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import type { WordTilesPreview } from './word-tiles-preview';

export function seatName(seat: number): string {
  const side = WORD_TILES_SEATS[seat];
  return side === 'white'
    ? t`Amber`
    : side === 'black'
      ? t`Teal`
      : side === 'red'
        ? t`Violet`
        : t`Coral`;
}

/** What the candidate would score, word by word, or why it cannot be played. */
export function WordTilesPreviewPanel(props: {
  preview: WordTilesPreview;
  testId: string;
}): JSX.Element {
  return (
    <StackVertical gap="xs" dataSet={{ testid: `${props.testId}-preview` }}>
      <Show when={props.preview.kind === 'score' && props.preview}>
        {(score) => (
          <>
            <For each={score().words}>
              {(word) => (
                <P variant="caption">
                  {`${word.word}: ${word.letters}${word.multiplier > 1 ? ` × ${word.multiplier}` : ''} = ${word.points}`}
                </P>
              )}
            </For>
            <Show when={score().bonus > 0}>
              <P variant="caption">{t`Seven-tile bonus: ${score().bonus}`}</P>
            </Show>
          </>
        )}
      </Show>
      <P role="status" dataSet={{ testid: `${props.testId}-status` }}>
        {props.preview.message}
      </P>
    </StackVertical>
  );
}

/** The letter a placed blank plays: chosen here, changeable until submitted. */
export function WordTilesBlankChooser(props: {
  testId: string;
  onChoose: (letter: string) => void;
}): JSX.Element {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return (
    <StackVertical gap="xs">
      <P variant="bodyBold">{t`Choose the letter your blank plays`}</P>
      <StackHorizontal gap="xs" wrap>
        <For each={letters}>
          {(letter) => (
            <Button
              title={letter}
              size="sm"
              variant="outline"
              intent="neutral"
              dataSet={{ testid: `${props.testId}-blank-${letter}` }}
              onClick={() => props.onChoose(letter)}
            />
          )}
        </For>
      </StackHorizontal>
    </StackVertical>
  );
}
