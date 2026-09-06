/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import {
  ChevronRightIcon,
  LightbulbIcon,
  LogOutIcon,
  SettingsIcon,
  ShareIcon,
} from '../icons';
import { Text } from '../text';
import { BottomActionBar } from './bottom-action-bar';
import type { BottomActionBarItem } from './bottom-action-bar-types';

const noop = (): void => undefined;

const ACTIONS_ONLY: readonly BottomActionBarItem[] = [
  {
    type: 'action',
    id: 'hint',
    label: 'Hint',
    icon: LightbulbIcon,
    onClick: noop,
  },
  {
    type: 'action',
    id: 'retry',
    label: 'Retry',
    icon: LogOutIcon,
    onClick: noop,
  },
  {
    type: 'action',
    id: 'share',
    label: 'Share',
    icon: ShareIcon,
    onClick: noop,
  },
  {
    type: 'action',
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    onClick: noop,
    selected: true,
  },
];

/** Built inside the component: `endIcon` is JSX and needs the theme context. */
function mixedItems(): readonly BottomActionBarItem[] {
  return [
    {
      type: 'action',
      id: 'hint',
      label: 'Hint',
      icon: LightbulbIcon,
      onClick: noop,
    },
    {
      type: 'action',
      id: 'retry',
      label: 'Retry',
      icon: LogOutIcon,
      onClick: noop,
    },
    {
      type: 'button',
      id: 'next',
      title: 'Next',
      endIcon: <ChevronRightIcon />,
      onClick: noop,
    },
  ];
}

const BUTTONS_ONLY: readonly BottomActionBarItem[] = [
  {
    type: 'button',
    id: 'cancel',
    title: 'Cancel',
    intent: 'neutral',
    variant: 'outline',
    onClick: noop,
  },
  { type: 'button', id: 'confirm', title: 'Confirm', onClick: noop },
];

function SectionLabel(props: { label: string }): JSX.Element {
  return (
    <Text variant="label" sx={{ color: 'textSecondary' }} label={props.label} />
  );
}

export default function BottomActionBarExample(): JSX.Element {
  const mixed = mixedItems();
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Chess.com-style play chrome. Mix labeled icon tabs with solid buttons."
      />
      <SectionLabel label="Actions only" />
      <SchemePreview>
        <BottomActionBar items={ACTIONS_ONLY} />
      </SchemePreview>
      <SectionLabel label="Mixed" />
      <SchemePreview>
        <BottomActionBar items={mixed} />
      </SchemePreview>
      <SectionLabel label="Buttons only" />
      <SchemePreview>
        <BottomActionBar items={BUTTONS_ONLY} />
      </SchemePreview>
      <SectionLabel label="Unelevated" />
      <SchemePreview>
        <BottomActionBar items={mixed} elevated={false} />
      </SchemePreview>
    </ExampleRoot>
  );
}
