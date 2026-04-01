import { Box } from '../box';
import { Text } from '../text';
import { ScrollView } from './scroll-view';

export default function ScrollViewExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">ScrollView</Text>

      <Box sx={{ height: 200, borderWidth: 1, borderColor: 'border', borderRadius: 8 }}>
        <ScrollView sx={{ p: 3, gap: 2 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <Box key={i} sx={{ p: 3, background: 'surface', borderRadius: 6 }}>
              <Text variant="body">Item {i + 1}</Text>
            </Box>
          ))}
        </ScrollView>
      </Box>
    </Box>
  );
}
