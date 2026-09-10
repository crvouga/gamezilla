/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Card } from '../card';
import { Divider } from '../divider';
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

      <Divider />

      <label class="text textLabel text-text-secondary">
        {'Compact, no icon'}
      </label>
      <SchemePreview>
        <Card elevation={0}>
          <EmptyState
            variant="compact"
            title="No matching commands"
            body="Try a different search term."
          />
        </Card>
      </SchemePreview>

      <Divider />

      <label class="text textLabel text-text-secondary">
        {'Title only (list footer)'}
      </label>
      <SchemePreview>
        <Card elevation={0}>
          <EmptyState variant="compact" title="No rows match filter." />
        </Card>
      </SchemePreview>
    </ExampleRoot>
  );
}
