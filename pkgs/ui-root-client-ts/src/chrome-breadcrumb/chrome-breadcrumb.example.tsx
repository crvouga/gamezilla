/** @jsxImportSource solid-js */

import { ChromeBreadcrumb } from '@pkgs/ui-root-client-ts/chrome-breadcrumb';
import { MonogramTile } from '@pkgs/ui-root-client-ts/monogram-tile';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const ROOM = '5bace000-0000-4000-8000-000000000001';
const noop = (): void => undefined;

function tile(): JSX.Element {
  return <MonogramTile name="Friday game night" seed={ROOM} size="xs" />;
}

export default function ChromeBreadcrumbExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="the room alone: its name is the current place">
        <Surface tone="surface" radius="control" padding="md">
          <ChromeBreadcrumb
            size="subtitle"
            crumbs={[{ name: 'Friday game night', leading: tile() }]}
          />
        </Surface>
      </ExampleSection>
      <ExampleSection title="a game's own menu: the room is the way back">
        <Surface tone="surface" radius="control" padding="md">
          <ChromeBreadcrumb
            size="subtitle"
            crumbs={[
              { name: 'Friday game night', leading: tile(), onClick: noop },
              { name: 'Chess' },
            ]}
          />
        </Surface>
      </ExampleSection>
      <ExampleSection title="a screen the game opens: the game is the way back">
        <Surface tone="surface" radius="control" padding="md">
          <ChromeBreadcrumb
            size="subtitle"
            crumbs={[
              { name: 'Friday game night', leading: tile() },
              { name: 'Chess', onClick: noop },
            ]}
          />
        </Surface>
      </ExampleSection>
      <ExampleSection title="a long room name truncates first">
        <Surface tone="surface" radius="control" padding="md" maxWidth="form">
          <ChromeBreadcrumb
            crumbs={[
              {
                name: 'The extremely long and very descriptive name of a space about board games',
                leading: tile(),
                onClick: noop,
              },
              { name: 'Connect Four' },
            ]}
          />
        </Surface>
      </ExampleSection>
    </ExampleRoot>
  );
}
