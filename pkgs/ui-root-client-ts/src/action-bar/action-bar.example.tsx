/** @jsxImportSource solid-js */

import { ActionBar } from '@pkgs/ui-root-client-ts/action-bar';
import { useActionBarChrome } from '@pkgs/ui-root-client-ts/action-bar-chrome';
import type { ActionBarItem } from '@pkgs/ui-root-client-ts/action-bar-logic';
import {
  CodeIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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
      <p class="text textCaption text-text-secondary">
        {
          'Shrink the bar and watch actions overflow. Dev tools stay in the menu.'
        }
      </p>
      <SegmentedControl<WidthKey>
        segments={WIDTH_SEGMENTS}
        selected={widthKey()}
        onSelect={setWidthKey}
        aria-label="Bar width"
      />
      <div
        class="box self-start border-border border-solid p-2 items-end border"
        style={{ width: cssPx(width()) }}
      >
        <ActionBar
          items={BASE_ITEMS}
          buttonSize={chrome().buttonSize}
          gap={chrome().gap}
        />
      </div>
      <p class="text textCaption">{`Width: ${width()}px`}</p>
    </ExampleRoot>
  );
}
