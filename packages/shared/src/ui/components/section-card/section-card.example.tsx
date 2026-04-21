import { Box } from '../box';
import { Text } from '../text';
import { SectionCard } from './section-card';

export default function SectionCardExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="SectionCard" />
      <SectionCard title="Details" defaultOpen={false}>
        <Text
          variant="body"
          label="Hidden until expanded — same Collapsible behavior as before."
        />
      </SectionCard>
    </Box>
  );
}
