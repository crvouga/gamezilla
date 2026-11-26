import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { Show } from 'solid-js';
import { WordTilesPreviewPanel } from './word-tiles-panels';
import type { WordTilesPreview } from './word-tiles-preview';

/** `message` as a sentence, so the correction after it reads apart. */
function sentence(message: string): string {
  return /[.!?…]$/.test(message) ? message : `${message}.`;
}

/**
 * Keep a refused placement and its correction together, distinct from its
 * score, on the status line under the board: it comes and goes with the
 * draft without moving the board.
 */
export function PuzzlePlacementFeedback(props: {
  preview: WordTilesPreview;
  hasPlacement: boolean;
  target: number;
}) {
  return (
    <Show
      when={props.hasPlacement && !props.preview.playable}
      fallback={
        <StackVertical gap="xs">
          <WordTilesPreviewPanel
            preview={props.preview}
            testId="word-tiles-puzzle"
          />
          <Show
            when={
              props.hasPlacement &&
              props.preview.kind === 'score' &&
              props.preview
            }
          >
            {(score) => (
              <P
                role="status"
                dataSet={{ testid: 'word-tiles-puzzle-shortfall' }}
              >
                {score().total < props.target
                  ? t`You need ${props.target - score().total} more points to reach ${props.target}. Try adding tiles or using a bonus square.`
                  : t`This word reaches the ${props.target}-point target. Play it to finish.`}
              </P>
            )}
          </Show>
        </StackVertical>
      }
    >
      <P role="alert" dataSet={{ testid: 'word-tiles-puzzle-status' }}>
        <Text variant="bodyBold" tone="destructive">
          {sentence(props.preview.message)}
        </Text>{' '}
        {t`Recall tiles to try another word. Your rack is kept.`}
      </P>
    </Show>
  );
}

/** Returning to the library leaves the existing attempt intact. */
export function UnreadablePuzzle(props: { onReturnToLibrary: () => void }) {
  return (
    <StackVertical gap="sm" padding="lg" width="full" maxWidth="prose">
      <Notice tone="error">
        <P variant="bodyBold">{t`This puzzle cannot be opened.`}</P>
        <P>{t`Choose another puzzle from the library. This attempt is kept.`}</P>
        <Button title={t`Puzzle library`} onClick={props.onReturnToLibrary} />
      </Notice>
    </StackVertical>
  );
}
