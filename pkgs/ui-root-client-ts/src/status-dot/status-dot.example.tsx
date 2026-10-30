/** @jsxImportSource solid-js */

import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const ROWS: readonly { status: StatusDotStatus; label: string }[] = [
  { status: 'online', label: 'Online' },
  { status: 'offline', label: 'Offline' },
  { status: 'warning', label: 'Warning' },
  { status: 'pending', label: 'Pending' },
];

const PARTICIPANTS = ['player1', 'player2', 'player3', 'player4'] as const;

export default function StatusDotExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <StackVertical gap="lg">
          <ExampleSection title="status">
            <StackVertical gap="sm">
              <For each={ROWS}>
                {(row) => (
                  <StackHorizontal gap="sm" align="center">
                    <StatusDot status={row.status} label={row.label} />
                    <Text variant="label">{row.label}</Text>
                  </StackHorizontal>
                )}
              </For>
            </StackVertical>
          </ExampleSection>
          <ExampleSection title="color: a participant's color (data, not a role)">
            <StackHorizontal gap="sm" align="center">
              <For each={PARTICIPANTS}>
                {(name) => <StatusDot color={colorVar(name)} label={name} />}
              </For>
            </StackHorizontal>
          </ExampleSection>
          <ExampleSection title="size: 6 (in a tag), 10 (default), 16">
            <StackHorizontal gap="sm" align="center">
              <StatusDot status="online" size={6} />
              <StatusDot status="online" />
              <StatusDot status="online" size={16} />
            </StackHorizontal>
          </ExampleSection>
        </StackVertical>
      </SchemePreview>
    </ExampleRoot>
  );
}
