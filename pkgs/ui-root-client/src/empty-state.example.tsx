/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { EmptyState } from './empty-state';
import { ExampleRoot } from './example-root';
import { HouseIcon, SearchIcon, UsersIcon } from './icons';
import { SchemePreview } from './scheme-preview';

export default function EmptyStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">{'Fill'}</label>
      <SchemePreview>
        <div class="box h-70">
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
        {'Fill, no action'}
      </label>
      <SchemePreview>
        <div class="box h-70">
          <EmptyState
            icon={UsersIcon}
            title="No friends yet"
            body="People you add show up here."
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact with icon and action'}
      </label>
      <SchemePreview>
        <div class="panel">
          <EmptyState
            variant="compact"
            icon={SearchIcon}
            title="No results"
            body="Try a different search term."
            action={{ label: 'Clear search', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact, no icon'}
      </label>
      <SchemePreview>
        <div class="panel">
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
        <div class="panel">
          <EmptyState variant="compact" title="No rows match filter." />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
