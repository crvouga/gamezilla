/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Avatar } from './avatar';
import { LiveBadge } from './badge';
import { Button } from './button';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { MiniPlayerBar, MiniPlayerDock } from './mini-player';
import { Pressable } from './pressable';
import { StackVertical } from './stack';
import { P } from './text';

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
