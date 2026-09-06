/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { AppLogo } from './app-logo';

export default function AppLogoExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Mark + wordmark (default)"
      />
      <SchemePreview>
        <Stack spacing={4}>
          <AppLogo />
          <AppLogo size={36} />
          <AppLogo size={48} />
        </Stack>
      </SchemePreview>

      <Divider />

      <Text variant="label" sx={{ color: 'textSecondary' }} label="Mark only" />
      <SchemePreview>
        <Stack direction="horizontal" spacing={4} align="center">
          <AppLogo size={20} wordmark={false} />
          <AppLogo size={28} wordmark={false} />
          <AppLogo size={48} wordmark={false} />
        </Stack>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Tinted overrides"
      />
      <SchemePreview>
        <Stack spacing={3}>
          <AppLogo color="text" />
          <AppLogo color="destructive" />
          <AppLogo color="success" />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
