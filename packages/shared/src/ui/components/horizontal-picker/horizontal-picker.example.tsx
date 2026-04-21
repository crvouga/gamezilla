import { useState } from 'react';
import { View } from 'react-native';
import { Box } from '../box';
import { Text } from '../text';
import { HorizontalPicker } from './horizontal-picker';

type Fruit = { id: string; name: string; color: string };

const FRUITS: Fruit[] = [
  { id: 'a', name: 'Apple', color: '#ef4444' },
  { id: 'b', name: 'Banana', color: '#eab308' },
  { id: 'c', name: 'Cherry', color: '#be123c' },
  { id: 'd', name: 'Date', color: '#92400e' },
];

const W = 72;

export default function HorizontalPickerExample() {
  const [sel, setSel] = useState<string | null>('b');
  const [selRand, setSelRand] = useState<string | null>(null);

  return (
    <Box sx={{ p: 4, gap: 6 }}>
      <Text variant="heading" label="HorizontalPicker" />

      <Box sx={{ gap: 2 }}>
        <Text variant="label" label="Basic" />
        <HorizontalPicker
          items={FRUITS}
          keyFor={(f) => f.id}
          selectedKey={sel}
          onSelectItem={(f) => setSel(f.id)}
          itemWidth={W}
          captionFor={(f) => f.name}
          renderPreview={(f, selected) => (
            <View
              style={{
                width: W - 16,
                height: W - 16,
                borderRadius: (W - 16) / 2,
                backgroundColor: f.color,
                opacity: selected ? 1 : 0.85,
              }}
            />
          )}
        />
        <Text variant="caption" sx={{ opacity: 0.75 }} label={`Selected: ${sel}`} />
      </Box>

      <Box sx={{ gap: 2 }}>
        <Text variant="label" label="With leading random tile" />
        <HorizontalPicker
          items={FRUITS}
          keyFor={(f) => f.id}
          selectedKey={selRand}
          onSelectItem={(f) => setSelRand(f.id)}
          itemWidth={W}
          captionFor={(f) => f.name}
          randomItem={{
            selected: selRand === null,
            onSelect: () => setSelRand(null),
            render: () => (
              <Text style={{ fontSize: 22, fontWeight: '700' }} label="?" />
            ),
          }}
          renderPreview={(f, selected) => (
            <View
              style={{
                width: W - 16,
                height: W - 16,
                borderRadius: (W - 16) / 2,
                backgroundColor: f.color,
                opacity: selected ? 1 : 0.85,
              }}
            />
          )}
        />
        <Text
          variant="caption"
          sx={{ opacity: 0.75 }}
          label={`Selected: ${selRand === null ? 'random' : selRand}`}
        />
      </Box>
    </Box>
  );
}
