/** @jsxImportSource solid-js */

import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import {
  HouseIcon,
  SearchIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function SectionLabel(props: { label: string }): JSX.Element {
  return <p class="text textSectionLabel">{props.label}</p>;
}

export default function EmptyStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'An empty state invites: what is empty, one line on how to fill it, and the action that does.'
        }
      </p>
      <SectionLabel label="Fill, with the primary action" />
      <SchemePreview>
        <div class="box h-70">
          <EmptyState
            icon={HouseIcon}
            title="No live spaces"
            body="Start one and invite your friends."
            action={{ label: 'New space', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, guidance only" />
      <SchemePreview>
        <div class="box h-70">
          <EmptyState
            icon={UsersIcon}
            title="No friends yet"
            body="Search for someone by username to add them."
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, with icon and action" />
      <SchemePreview>
        <div class="panel">
          <EmptyState
            variant="compact"
            icon={SearchIcon}
            title="No results"
            body="Try a different search."
            action={{ label: 'Clear search', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, no icon (inside a list)" />
      <SchemePreview>
        <div class="panel">
          <EmptyState
            variant="compact"
            title="No matching commands"
            body="Try a different search."
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
