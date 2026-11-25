import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import { Show } from 'solid-js';
import type { LexiconState } from './use-word-tiles-lexicon';

/**
 * The target and completion above the board; a word list still loading or
 * that would not load is said in a toast, with its retry, so the board never
 * moves when it comes or goes.
 */
export function WordTilesPuzzleStatus(props: {
  readonly target: number;
  readonly score: number | null;
  readonly complete: boolean;
  readonly disabled: boolean;
  readonly lexicon: LexiconState;
  readonly onRetryLexicon: () => void;
  readonly onReturnToLibrary: () => void;
}) {
  return (
    <>
      <P variant="bodyBold" dataSet={{ testid: 'word-tiles-puzzle-target' }}>
        {t`Score at least ${props.target} points in one move.`}
      </P>
      <Show when={props.score !== null}>
        <P role="status" dataSet={{ testid: 'word-tiles-puzzle-score' }}>
          {t`Your last move scored ${props.score ?? 0} of ${props.target}.`}
        </P>
      </Show>
      <Show when={props.complete}>
        <Notice tone="success">
          <P
            variant="bodyBold"
            role="status"
            dataSet={{ testid: 'word-tiles-puzzle-complete' }}
          >{t`Target reached. Puzzle solved!`}</P>
        </Notice>
        {/* On the page's left edge with the target, not under the notice's icon. */}
        <StackHorizontal gap="sm">
          <Button title={t`Puzzle library`} onClick={props.onReturnToLibrary} />
        </StackHorizontal>
      </Show>
      <Show when={props.disabled && !props.complete}>
        <P role="status">{t`This attempt is read-only. Placement is unavailable.`}</P>
      </Show>
      <PuzzleLexiconToast
        hidden={props.complete || props.lexicon.status === 'ready'}
        lexicon={props.lexicon}
        onRetryLexicon={props.onRetryLexicon}
      />
    </>
  );
}

/** Loading the word list, or its retry, there until the list is ready. */
function PuzzleLexiconToast(props: {
  readonly hidden: boolean;
  readonly lexicon: LexiconState;
  readonly onRetryLexicon: () => void;
}) {
  return (
    <ToastStack persistent>
      <Show when={!props.hidden}>
        <Notice
          tone={props.lexicon.status === 'unavailable' ? 'warning' : 'info'}
        >
          <P role="status">
            {props.lexicon.status === 'loading'
              ? t`Loading the word list. Your tiles are kept.`
              : t`The word list could not load. Your tiles are kept. Retry to check and play your word.`}
          </P>
          <Show when={props.lexicon.status === 'unavailable'}>
            <StackHorizontal gap="sm">
              <Button
                title={t`Retry word list`}
                onClick={() => props.onRetryLexicon()}
              />
            </StackHorizontal>
          </Show>
        </Notice>
      </Show>
    </ToastStack>
  );
}
