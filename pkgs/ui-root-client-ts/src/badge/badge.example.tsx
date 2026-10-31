/** @jsxImportSource solid-js */

import {
  Badge,
  type BadgeIntent,
  HostBadge,
  LiveBadge,
} from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const INTENTS: readonly { intent: BadgeIntent; label: string }[] = [
  { intent: 'brand', label: 'Brand' },
  { intent: 'success', label: 'Success' },
  { intent: 'warning', label: 'Warning' },
  { intent: 'destructive', label: 'Destructive' },
  { intent: 'info', label: 'Info' },
  { intent: 'neutral', label: 'Neutral' },
];

function Row(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <ExampleSection title={props.title}>
      <StackHorizontal gap="sm" align="center" wrap>
        {props.children}
      </StackHorizontal>
    </ExampleSection>
  );
}

function Tones(): JSX.Element {
  return (
    <>
      <Row title="Subtle (default)">
        <For each={INTENTS}>
          {(row) => <Badge label={row.label} intent={row.intent} />}
        </For>
      </Row>
      <Row title="Solid">
        <For each={INTENTS}>
          {(row) => (
            <Badge label={row.label} intent={row.intent} tone="solid" />
          )}
        </For>
      </Row>
    </>
  );
}

export default function BadgeExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <StackVertical gap="lg">
          <Row title="Fixed tags: LIVE (the only all-caps word) and Host">
            <LiveBadge />
            <HostBadge />
            <HostBadge size="sm" />
          </Row>
          <Tones />
          <Row title="Sizes: md 24px, sm 16px">
            <Badge label="New" intent="success" />
            <Badge label="Updated" intent="info" size="sm" />
            <Badge label="3" intent="destructive" size="sm" />
          </Row>
          <Row title="Presence dot">
            <Badge label="Online" intent="neutral" dot="online" />
            <Badge label="Away" intent="neutral" dot="offline" />
          </Row>
          <Row title="Counts (brand solid)">
            <Badge label="1" intent="brand" tone="solid" size="sm" />
            <Badge label="12" intent="brand" tone="solid" size="sm" />
            <Badge label="99+" intent="brand" tone="solid" size="sm" />
          </Row>
          <ExampleSection title="A long label ends in an ellipsis">
            <StackVertical gap="sm">
              <Badge
                label="A tag far too long for the narrow row it has to sit in, so it truncates"
                intent="neutral"
              />
            </StackVertical>
          </ExampleSection>
          <Row title="invisible keeps the box (between the brackets)">
            <Badge label="[" intent="neutral" />
            <Badge label="Hidden" intent="brand" invisible />
            <Badge label="]" intent="neutral" />
          </Row>
        </StackVertical>
      </SchemePreview>
    </ExampleRoot>
  );
}
