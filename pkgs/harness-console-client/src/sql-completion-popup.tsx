import { SuggestionList } from '@pkgs/ui-root-client/suggestion-list';
import type { Accessor, JSX } from 'solid-js';

import type { CompletionResult } from './sql-completion';

/** Completions under a SQL cell; the editor keeps the keyboard. */
export function SqlCompletionPopup(props: {
  readonly result: CompletionResult;
  readonly selectedIndex: Accessor<number>;
  readonly onSelect: (label: string) => void;
  readonly onHover: (index: number) => void;
}): JSX.Element {
  return (
    <SuggestionList
      aria-label="SQL completions"
      items={props.result.candidates.map((candidate) => ({
        key: candidate.label,
        label: candidate.label,
        detail: candidate.kind,
      }))}
      highlighted={props.selectedIndex()}
      onPick={props.onSelect}
      onHighlight={props.onHover}
    />
  );
}
