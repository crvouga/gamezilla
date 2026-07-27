import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../text';
import { HorizontalPicker } from './horizontal-picker';
import { ExampleRoot } from '../explorer/example-root';

type ColorCard = { id: string; label: string; color: string };

const CARDS: ColorCard[] = [
  { id: '1', label: 'Crimson', color: '#ef4444' },
  { id: '2', label: 'Amber', color: '#f59e0b' },
  { id: '3', label: 'Lime', color: '#84cc16' },
  { id: '4', label: 'Teal', color: '#14b8a6' },
  { id: '5', label: 'Sky', color: '#0ea5e9' },
  { id: '6', label: 'Indigo', color: '#6366f1' },
  { id: '7', label: 'Violet', color: '#8b5cf6' },
  { id: '8', label: 'Rose', color: '#f43f5e' },
];

const ITEM_WIDTH = 120;
const CARD_SIZE = 96;

export default function HorizontalPickerExample() {
  const [index, setIndex] = useState(2);
  const selected = CARDS[index];

  return (
    <ExampleRoot>
      <Text variant="heading" label="HorizontalPicker" />
      <Text
        variant="body"
        sx={{ opacity: 0.75 }}
        label="Centered carousel with snap, scale/opacity, and arrow navigation."
      />
      <HorizontalPicker
        items={CARDS}
        selectedIndex={index}
        onSelect={(_item, i) => setIndex(i)}
        itemWidth={ITEM_WIDTH}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <View
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              borderRadius: 12,
              backgroundColor: item.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              variant="caption"
              style={{ color: '#fff', fontWeight: '700' }}
              label={item.label}
            />
          </View>
        )}
      />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label={
          selected
            ? `Selected: ${selected.label} (index ${index})`
            : 'No selection'
        }
      />
    </ExampleRoot>
  );
}
