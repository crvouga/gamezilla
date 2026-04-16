import {
  Box,
  SafeAreaView,
  SegmentedControl,
  Text,
} from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui/theme';
import { useState } from 'react';
import { PlaygroundPage } from './pages/playground-page';

type Mode = 'playground' | 'docs';

const SEGMENTS = [
  { key: 'playground' as const, label: 'Playground' },
  { key: 'docs' as const, label: 'Docs' },
];

export function App() {
  const [mode, setMode] = useState<Mode>('playground');
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ px: 3, py: 2 }}>
          <SegmentedControl
            segments={SEGMENTS}
            selected={mode}
            onSelect={setMode}
          />
        </Box>
        {mode === 'playground' ? (
          <PlaygroundPage />
        ) : (
          <Box sx={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text variant="caption" label="Documentation coming soon." />
          </Box>
        )}
      </Box>
    </SafeAreaView>
  );
}
