/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { HouseIcon } from '../icons';
import { EmptyState } from './empty-state';

export default function EmptyStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">{'Fill'}</label>
      <SchemePreview>
        <div class="box h-[280px]">
          <EmptyState
            icon={HouseIcon}
            title="No live spaces"
            body="Tap + New space to start one."
            action={{ label: '+ New space', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact, no icon'}
      </label>
      <SchemePreview>
        <div class="card">
          <EmptyState
            variant="compact"
            title="No matching commands"
            body="Try a different search term."
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Title only (list footer)'}
      </label>
      <SchemePreview>
        <div class="card">
          <EmptyState variant="compact" title="No rows match filter." />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
