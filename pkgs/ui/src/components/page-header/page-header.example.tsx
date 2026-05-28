import { Box } from '../box';
import { Divider } from '../divider';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { PageHeader } from './page-header';

export default function PageHeaderExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="PageHeader" />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Title only"
      />
      <SchemePreview>
        <PageHeader title="Spaces" />
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Title + subtitle"
      />
      <SchemePreview>
        <Stack spacing={4}>
          <PageHeader title="Spaces" subtitle="Rooms to play with friends" />
          <PageHeader
            title="Settings"
            subtitle="App preferences and tools"
          />
        </Stack>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Centered alignment"
      />
      <SchemePreview>
        <PageHeader
          title="About"
          subtitle="App version and build metadata"
          align="center"
        />
      </SchemePreview>
    </Box>
  );
}
