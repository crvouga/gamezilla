import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Show } from 'solid-js';
import type { LexiconState } from './use-word-tiles-lexicon';

/** Completion and word-list recovery stay visible above the editable board. */
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
          <Button title={t`Puzzle library`} onClick={props.onReturnToLibrary} />
        </Notice>
      </Show>
      <Show when={props.disabled && !props.complete}>
        <P role="status">{t`This attempt is read-only. Placement is unavailable.`}</P>
      </Show>
      <Show when={!props.complete && props.lexicon.status !== 'ready'}>
        <P role="status">
          {props.lexicon.status === 'loading'
            ? t`Loading the word list. Your tiles are kept.`
            : t`The word list could not load. Your tiles are kept. Retry to check and play your word.`}
        </P>
        <Show when={props.lexicon.status === 'unavailable'}>
          <Button
            title={t`Retry word list`}
            onClick={() => props.onRetryLexicon()}
          />
        </Show>
      </Show>
    </>
  );
}
