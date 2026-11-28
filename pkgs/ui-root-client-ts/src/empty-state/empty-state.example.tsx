/** @jsxImportSource @solidjs/web */

import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import {
  CompassIcon,
  HouseIcon,
  SearchIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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

      <div class="box h-70">
        <EmptyState
          icon={HouseIcon}
          title="No live spaces"
          body="Start one and invite your friends."
          action={{ label: 'New space', onClick: () => undefined }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, with a quieter way out" />

      <div class="box h-70">
        <EmptyState
          icon={CompassIcon}
          title="There's nothing at this address"
          body="The link may be old or mistyped."
          action={{ label: 'Go to Spaces', onClick: () => undefined }}
          secondaryAction={{ label: 'Go back', onClick: () => undefined }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="On the page title's edge (align start)" />

      <div class="box h-70">
        <EmptyState
          align="start"
          icon={CompassIcon}
          title="There's nothing at this address"
          body="The link may be old or mistyped."
          action={{ label: 'Go to Spaces', onClick: () => undefined }}
          secondaryAction={{ label: 'Go back', onClick: () => undefined }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, guidance only" />

      <div class="box h-70">
        <EmptyState
          icon={UsersIcon}
          title="No friends yet"
          body="Search for someone by username to add them."
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, with icon and action" />

      <div class="panel">
        <EmptyState
          variant="compact"
          icon={SearchIcon}
          title="No results"
          body="Try a different search."
          action={{ label: 'Clear search', onClick: () => undefined }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, no icon (inside a list)" />

      <div class="panel">
        <EmptyState
          variant="compact"
          title="No matching commands"
          body="Try a different search."
        />
      </div>
    </ExampleRoot>
  );
}
