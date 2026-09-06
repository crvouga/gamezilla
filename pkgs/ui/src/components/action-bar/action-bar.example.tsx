/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { useActionBarChrome } from '../../theme';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { CodeIcon, SettingsIcon, UserIcon } from '../icons';
import { SegmentedControl } from '../segmented-control';
import { Text } from '../text';
import { ActionBar } from './action-bar';
import type { ActionBarItem } from './action-bar-logic';

const BASE_ITEMS: readonly ActionBarItem[] = [
  {
    id: 'account',
    label: 'Account',
    shortLabel: 'Account',
    icon: UserIcon,
    onClick: () => undefined,
    priority: 3,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: SettingsIcon,
    onClick: () => undefined,
    priority: 2,
  },
  {
    id: 'devtools',
    label: 'Developer tools',
    icon: CodeIcon,
    onClick: () => undefined,
    overflow: 'always',
    endsGroup: true,
  },
];

type WidthKey = '160' | '280' | '420';

const WIDTH_SEGMENTS = [
  { key: '160' as const, label: 'Narrow' },
  { key: '280' as const, label: 'Medium' },
  { key: '420' as const, label: 'Wide' },
];

export default function ActionBarExample(): JSX.Element {
  const [widthKey, setWidthKey] = createSignal<WidthKey>('280');
  const width = () => Number(widthKey());
  const chrome = useActionBarChrome();

  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Shrink the bar and watch actions overflow. Dev tools stay in the menu."
      />
      <SegmentedControl<WidthKey>
        segments={WIDTH_SEGMENTS}
        selected={widthKey()}
        onSelect={setWidthKey}
        aria-label="Bar width"
      />
      <Box
        sx={{
          alignSelf: 'flex-start',
          borderColor: 'border',
          borderStyle: 'solid',
          p: 2,
          alignItems: 'flex-end',
          borderWidth: 1,
          width: width(),
        }}
      >
        <ActionBar
          items={BASE_ITEMS}
          buttonSize={chrome().buttonSize}
          gap={chrome().gap}
          slotWidth={chrome().slotWidth}
          showInlineLabels={chrome().showInlineLabels}
        />
      </Box>
      <Text variant="caption" label={`Width: ${width()}px`} />
    </ExampleRoot>
  );
}
