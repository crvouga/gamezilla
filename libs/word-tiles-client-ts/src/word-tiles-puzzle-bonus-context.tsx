import { t } from '@lingui/core/macro';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { WordTileBoardCell } from '@pkgs/ui-root-client-ts/word-tile-board';

function bonusText(cell: WordTileBoardCell): string {
  const description = {
    DL: t`2L doubles this letter.`,
    TL: t`3L triples this letter.`,
    DW: t`2W doubles the word.`,
    TW: t`3W triples the word.`,
    start: t`2W doubles the word.`,
  };
  const bonus =
    cell.square === null
      ? t`No bonus on this square.`
      : description[cell.square];
  const blank = cell.points === 0 ? t`Blank tiles score 0.` : '';
  return `${cell.id}: ${bonus}${blank === '' ? '' : ` ${blank}`}`;
}

/** Explain the last drafted tile's covered bonus; recall restores the compact key. */
export function PuzzleBonusContext(props: {
  cell: WordTileBoardCell | undefined;
}) {
  return (
    <P variant="caption" dataSet={{ testid: 'word-tiles-puzzle-bonus' }}>
      {props.cell === undefined
        ? t`2L/3L: double/triple letter. 2W/3W: double/triple word.`
        : bonusText(props.cell)}
    </P>
  );
}
