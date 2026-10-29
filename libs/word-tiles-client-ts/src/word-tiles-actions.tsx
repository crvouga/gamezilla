import { t } from '@lingui/core/macro';
import type { GameFrameAction } from '@pkgs/turn-game-shared-ts/game-frame';
import {
  candidateProposal,
  recallAll,
  redoEdit,
  shuffleRack,
  toggleExchange,
  undoEdit,
} from './word-tiles-candidate';
import type { WordTilesDraft } from './word-tiles-draft';

/** Sends the draft's proposal, as it stands when pressed. */
function propose(draft: WordTilesDraft): void {
  const proposal = candidateProposal(draft.candidate());
  if (proposal !== null) draft.props.onAction(proposal);
}

/** Choosing tiles to exchange: offered, or (while choosing) confirmed or called off. */
function exchangeActions(draft: WordTilesDraft): readonly GameFrameAction[] {
  const interactive = draft.props.interactive;
  if (draft.candidate().exchange === null)
    return [
      {
        id: 'exchange',
        label: t`Exchange tiles`,
        enabled: interactive && (draft.position()?.bag ?? 0) >= 7,
        run: () => draft.update(toggleExchange),
      },
    ];
  return [
    {
      id: 'exchange-confirm',
      label: t`Exchange chosen tiles`,
      enabled: interactive && candidateProposal(draft.candidate()) !== null,
      emphasis: 'primary',
      run: () => propose(draft),
    },
    {
      id: 'exchange-cancel',
      label: t`Cancel exchange`,
      enabled: true,
      run: () => draft.update(toggleExchange),
    },
  ];
}

/**
 * What the seat can do with its draft: play it, take it back, step through
 * its edits, shuffle the rack, pass, or exchange tiles. Each id is the
 * control the Word Tiles automation presses (`${board}-${id}`). A watcher,
 * or anyone once the game is over, has none.
 */
export function wordTilesActions(
  draft: WordTilesDraft,
  random: () => number
): readonly GameFrameAction[] {
  if (!draft.editable()) return [];
  const candidate = draft.candidate();
  const interactive = draft.props.interactive;
  return [
    {
      id: 'submit',
      label: t`Play word`,
      enabled:
        interactive &&
        (draft.preview()?.playable ?? false) &&
        candidateProposal(candidate) !== null,
      // While tiles are chosen to exchange, confirming is the next step.
      ...(candidate.exchange === null ? { emphasis: 'primary' as const } : {}),
      run: () => propose(draft),
    },
    {
      id: 'recall',
      label: t`Recall tiles`,
      enabled: candidate.placed.length > 0,
      run: () => draft.update(recallAll),
    },
    {
      id: 'undo',
      label: t`Undo`,
      enabled: candidate.undo.length > 0,
      run: () => draft.update(undoEdit),
    },
    {
      id: 'redo',
      label: t`Redo`,
      enabled: candidate.redo.length > 0,
      run: () => draft.update(redoEdit),
    },
    {
      id: 'shuffle',
      label: t`Shuffle rack`,
      enabled: true,
      run: () => draft.update((c) => shuffleRack(c, random)),
    },
    {
      id: 'pass',
      label: t`Pass`,
      enabled: interactive,
      run: () => draft.props.onAction('pass'),
    },
    ...exchangeActions(draft),
  ];
}
