/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  MiniPlayerBar,
  MiniPlayerDock,
} from '@pkgs/ui-root-client-ts/mini-player';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function MiniPlayerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="One live space: open it, or end it">
        <MiniPlayerDock>
          <MiniPlayerBar>
            <Pressable
              grow
              self="stretch"
              direction="horizontal"
              align="center"
              gap="md"
              padding="md"
              aria-label="Return to your space"
            >
              <Avatar initials="RB" size="md" />
              <StackVertical grow>
                <P variant="bodyBold" lines={1}>
                  {"Robin's space"}
                </P>
                <P variant="caption" lines={1}>
                  {'3 people here'}
                </P>
              </StackVertical>
              <LiveBadge />
            </Pressable>
            <StackVertical paddingEnd="md">
              <Button title="End" size="sm" intent="neutral" />
            </StackVertical>
          </MiniPlayerBar>
        </MiniPlayerDock>
      </ExampleSection>
    </ExampleRoot>
  );
}
