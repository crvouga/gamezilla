import { Box } from '../box';
import { Divider } from '../divider';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { SuccessState } from './success-state';

export default function SuccessStateExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="SuccessState" />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Fill (post-step confirmation)"
      />
      <SchemePreview>
        <Box style={{ height: 280 }}>
          <SuccessState
            title="Profile updated"
            body="Your changes will be visible to teammates after the next sync."
            action={{ label: 'Done', onPress: () => {} }}
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
          body="Local view updates after the next PatchDB sync."
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
    </Box>
  );
}
