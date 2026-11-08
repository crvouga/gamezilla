import { WORD_TILES_SEATS } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { WordTileBoardCell } from '@pkgs/ui-root-client-ts/word-tile-board';
import {
  WordTileBlankContext,
  WordTileLetterChoices,
} from '@pkgs/ui-root-client-ts/word-tile-workbench';
import { For, type JSX } from 'solid-js';
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
  // One breakdown line is always laid out, empty until tiles are placed, so
  // placing the first tile or playing the word never moves the board below.
  const breakdown = (): string => {
    const preview = props.preview;
    if (preview.kind !== 'score') return '';
    const words = preview.words.map(
      (word) =>
        `${word.word}: ${word.letters}${word.multiplier > 1 ? ` × ${word.multiplier}` : ''} = ${word.points}`
    );
    if (preview.bonus > 0) words.push(t`Seven-tile bonus: ${preview.bonus}`);
    return words.join(' · ');
  };
  return (
    <StackVertical gap="xs" dataSet={{ testid: `${props.testId}-preview` }}>
      <P
        variant="caption"
        aria-hidden={breakdown() === '' ? true : undefined}
        testId={`${props.testId}-breakdown`}
      >
        {breakdown() === '' ? '\u00a0' : breakdown()}
      </P>
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
  onCancel: () => void;
  cells: readonly WordTileBoardCell[];
  index: number;
  summary: string;
}): JSX.Element {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return (
    <ResponsiveSurface
      visible
      onClose={props.onCancel}
      presentation="modal"
      title={t`Choose the letter your blank plays`}
      label={t`Choose the letter your blank plays`}
      size="medium"
    >
      <StackVertical gap="sm">
        <WordTileBlankContext
          cells={props.cells}
          index={props.index}
          summary={props.summary}
          testId={props.testId}
        />
        <WordTileLetterChoices
          label={t`Choose the letter your blank plays`}
          onLetter={props.onChoose}
        >
          <For each={letters}>
            {(letter) => (
              <Button
                title={letter}
                size="md"
                variant="outline"
                intent="neutral"
                dataSet={{ testid: `${props.testId}-blank-${letter}` }}
                onClick={() => props.onChoose(letter)}
              />
            )}
          </For>
        </WordTileLetterChoices>
        <Button
          title={t`Cancel blank placement`}
          variant="outline"
          onClick={props.onCancel}
        />
      </StackVertical>
    </ResponsiveSurface>
  );
}
