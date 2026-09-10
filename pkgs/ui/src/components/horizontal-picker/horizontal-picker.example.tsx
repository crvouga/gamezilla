/** @jsxImportSource solid-js */

import { createSignal, type JSX } from 'solid-js';
import { cssPx } from '../../css/css-px';
import { ExampleRoot } from '../explorer/example-root';
import { HorizontalPicker } from './horizontal-picker';

type ColorCard = { id: string; label: string; color: string };

const CARDS: readonly ColorCard[] = [
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

export default function HorizontalPickerExample(): JSX.Element {
  const [index, setIndex] = createSignal(2);
  const selected = () => CARDS[index()];
  const summary = (): string => {
    const card = selected();
    return card === undefined
      ? 'No selection'
      : `Selected: ${card.label} (index ${index()})`;
  };

  return (
    <ExampleRoot>
      <p class="text opacity-75">
        {'Centered carousel with snap, scale/opacity, and arrow navigation.'}
      </p>
      <HorizontalPicker<ColorCard>
        items={CARDS}
        selectedIndex={index()}
        onSelect={(_item, i) => setIndex(i)}
        itemWidth={ITEM_WIDTH}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <div
            class="box rounded-[12px] items-center justify-center"
            style={{
              'background-color': item.color,
              width: cssPx(CARD_SIZE),
              height: cssPx(CARD_SIZE),
            }}
          >
            <p class="text textCaption text-[#fff] font-bold">{item.label}</p>
          </div>
        )}
      />
      <p class="text textCaption opacity-75">{summary()}</p>
    </ExampleRoot>
  );
}
