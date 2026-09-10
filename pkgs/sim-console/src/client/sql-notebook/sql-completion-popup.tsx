import { Badge } from '@pkgs/ui';
import type { Accessor } from 'solid-js';
import { For, type JSX } from 'solid-js';

import type { CompletionCandidate, CompletionResult } from './sql-completion';

export function SqlCompletionPopup(props: {
  readonly result: CompletionResult;
  readonly selectedIndex: Accessor<number>;
  readonly onSelect: (label: string) => void;
  readonly onHover: (index: number) => void;
}): JSX.Element {
  return (
    <div
      class="box border border-outline rounded-[10px] bg-surface max-h-[180px] overflow-hidden"
      data-component="SqlCompletionPopup"
    >
      <For each={props.result.candidates}>
        {(candidate, index) => (
          <CompletionRow
            candidate={candidate}
            selected={props.selectedIndex() === index()}
            onPress={() => props.onSelect(candidate.label)}
            onHover={() => props.onHover(index())}
          />
        )}
      </For>
    </div>
  );
}

function CompletionRow(props: {
  readonly candidate: CompletionCandidate;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly onHover: () => void;
}): JSX.Element {
  const { candidate, selected, onPress, onHover } = props;
  return (
    <button
      class="clickable clickableTint flex-row items-center gap-2 px-2 py-1"
      style={{ background: selected ? 'tintSubtle' : 'transparent' }}
      type="button"
      onClick={onPress}
      onMouseEnter={onHover}
    >
      <code class="text textMono flex-1 text-[12px] text-text">
        {candidate.label}
      </code>
      <Badge label={candidate.kind} intent="neutral" size="sm" />
    </button>
  );
}
