import {
  type Lexicon,
  loadedLexicon,
  loadLexicon,
} from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import { type Accessor, createEffect, createSignal, on } from 'solid-js';

export type LexiconState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly lexicon: Lexicon }
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * The word list a game pins, decoded the first time a game needs it. While
 * it loads, or when it cannot, the board
 * says so: the preview is advisory and the authority still decides.
 */
export function useWordTilesLexicon(key: Accessor<string>) {
  const [state, setState] = createSignal<LexiconState>({ status: 'loading' });
  const [attempt, setAttempt] = createSignal(0);
  createEffect(
    on([key, attempt], ([wanted]) => {
      const ready = loadedLexicon(wanted);
      if (ready !== null) {
        setState({ status: 'ready', lexicon: ready });
        return;
      }
      setState({ status: 'loading' });
      void loadLexicon(wanted).then(
        (lexicon) => {
          if (key() === wanted) setState({ status: 'ready', lexicon });
        },
        (error: unknown) => {
          if (key() === wanted)
            setState({
              status: 'unavailable',
              reason: error instanceof Error ? error.message : String(error),
            });
        }
      );
    })
  );
  return { state, retry: () => setAttempt((n) => n + 1) };
}
