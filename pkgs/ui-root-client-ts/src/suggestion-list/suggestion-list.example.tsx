/** @jsxImportSource solid-js */

import { SuggestionList } from '@pkgs/ui-root-client-ts/suggestion-list';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const ITEMS = [
  { key: 'users', label: 'users', detail: 'table' },
  { key: 'user_id', label: 'user_id', detail: 'column' },
  { key: 'UPDATE', label: 'UPDATE', detail: 'keyword' },
] as const;

export default function SuggestionListExample(): JSX.Element {
  const [highlighted, setHighlighted] = createSignal(0);
  const [picked, setPicked] = createSignal('');
  return (
    <ExampleRoot>
      <ExampleSection title="Completions; hover moves the highlight">
        <SuggestionList
          aria-label="Completions"
          items={ITEMS}
          highlighted={highlighted()}
          onHighlight={setHighlighted}
          onPick={setPicked}
        />
        <P variant="caption">{`Picked: ${picked() || '—'}`}</P>
      </ExampleSection>
    </ExampleRoot>
  );
}
