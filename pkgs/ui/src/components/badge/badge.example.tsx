/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Badge } from './badge';

export default function BadgeExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label="Intent surfaces"
          />
          <Stack direction="horizontal" spacing={2} wrap>
            <Badge label="Brand" intent="brand" />
            <Badge label="Success" intent="success" />
            <Badge label="Warning" intent="warning" />
            <Badge label="Destructive" intent="destructive" />
            <Badge label="Info" intent="info" />
            <Badge label="Neutral" intent="neutral" />
          </Stack>

          <Text variant="label" sx={{ color: 'textSecondary' }} label="Sizes" />
          <Stack direction="horizontal" spacing={2} align="center">
            <Badge label="3" intent="destructive" size="sm" />
            <Badge label="99+" intent="brand" size="sm" />
            <Badge label="New" intent="success" />
            <Badge label="Updated" intent="info" />
          </Stack>

          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label="Notification count (brand solid)"
          />
          <Stack direction="horizontal" spacing={2} align="center">
            <Badge label="1" intent="brand" tone="solid" size="sm" />
            <Badge label="12" intent="brand" tone="solid" size="sm" />
            <Badge label="99+" intent="brand" tone="solid" size="sm" />
          </Stack>
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
