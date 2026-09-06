/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { SuccessState } from './success-state';

export default function SuccessStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Fill (post-step confirmation)"
      />
      <SchemePreview>
        <Box sx={{ height: 280 }}>
          <SuccessState
            title="Profile updated"
            body="Your changes will be visible to teammates after the next sync."
            action={{ label: 'Done', onClick: () => undefined }}
          />
        </Box>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Compact (inline confirmation)"
      />
      <SchemePreview>
        <SuccessState
          variant="compact"
          title="Server config updated"
          body="Local view updates after the next sync."
        />
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Title only"
      />
      <SchemePreview>
        <SuccessState variant="compact" title="Saved" />
      </SchemePreview>
    </ExampleRoot>
  );
}
