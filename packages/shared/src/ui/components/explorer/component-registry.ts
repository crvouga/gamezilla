import type { ComponentType } from 'react';

import { default as BoxExample } from '../box/box.example';
import { default as GradientBoxExample } from '../gradient-box/gradient-box.example';
import { default as TextExample } from '../text/text.example';
import { default as PressableExample } from '../pressable/pressable.example';

import { default as StackExample } from '../stack/stack.example';
import { default as CenterExample } from '../center/center.example';
import { default as DividerExample } from '../divider/divider.example';
import { default as SpacerExample } from '../spacer/spacer.example';
import { default as ScrollViewExample } from '../scroll-view/scroll-view.example';
import { default as SafeAreaViewExample } from '../safe-area-view/safe-area-view.example';

import { default as ButtonExample } from '../button/button.example';
import { default as IconButtonExample } from '../icon-button/icon-button.example';
import { default as TextInputExample } from '../text-input/text-input.example';
import { default as SwitchExample } from '../switch/switch.example';
import { default as CheckboxExample } from '../checkbox/checkbox.example';

import { default as CardExample } from '../card/card.example';
import { default as AvatarExample } from '../avatar/avatar.example';
import { default as BadgeExample } from '../badge/badge.example';
import { default as ChipExample } from '../chip/chip.example';
import { default as ListExample } from '../list/list.example';

import { default as SpinnerExample } from '../spinner/spinner.example';
import { default as SkeletonExample } from '../skeleton/skeleton.example';
import { default as ProgressBarExample } from '../progress-bar/progress-bar.example';

import { default as CollapsibleExample } from '../collapsible/collapsible.example';

import { default as SelectExample } from '../select/select.example';
import { default as SegmentedControlExample } from '../segmented-control/segmented-control.example';

import { default as StatusDotExample } from '../status-dot/status-dot.example';

import { default as ModalExample } from '../modal/modal.example';
import { default as CommandPaletteExample } from '../command-palette/command-palette.example';

export type ComponentEntry = {
  name: string;
  category: string;
  Example: ComponentType;
};

export const componentRegistry: ComponentEntry[] = [
  // Foundation
  { name: 'Box', category: 'Foundation', Example: BoxExample },
  { name: 'GradientBox', category: 'Foundation', Example: GradientBoxExample },
  { name: 'Text', category: 'Foundation', Example: TextExample },
  { name: 'Pressable', category: 'Foundation', Example: PressableExample },

  // Layout
  { name: 'Stack', category: 'Layout', Example: StackExample },
  { name: 'Center', category: 'Layout', Example: CenterExample },
  { name: 'Divider', category: 'Layout', Example: DividerExample },
  { name: 'Spacer', category: 'Layout', Example: SpacerExample },
  { name: 'ScrollView', category: 'Layout', Example: ScrollViewExample },
  { name: 'SafeAreaView', category: 'Layout', Example: SafeAreaViewExample },

  // Inputs
  { name: 'Button', category: 'Inputs', Example: ButtonExample },
  { name: 'IconButton', category: 'Inputs', Example: IconButtonExample },
  { name: 'TextInput', category: 'Inputs', Example: TextInputExample },
  { name: 'Switch', category: 'Inputs', Example: SwitchExample },
  { name: 'Checkbox', category: 'Inputs', Example: CheckboxExample },

  // Data Display
  { name: 'Card', category: 'Data Display', Example: CardExample },
  { name: 'Avatar', category: 'Data Display', Example: AvatarExample },
  { name: 'Badge', category: 'Data Display', Example: BadgeExample },
  { name: 'Chip', category: 'Data Display', Example: ChipExample },
  { name: 'List', category: 'Data Display', Example: ListExample },

  // Feedback
  { name: 'Spinner', category: 'Feedback', Example: SpinnerExample },
  { name: 'Skeleton', category: 'Feedback', Example: SkeletonExample },
  { name: 'ProgressBar', category: 'Feedback', Example: ProgressBarExample },

  // Disclosure
  { name: 'Collapsible', category: 'Disclosure', Example: CollapsibleExample },

  // Compound Inputs
  { name: 'Select', category: 'Inputs', Example: SelectExample },
  { name: 'SegmentedControl', category: 'Inputs', Example: SegmentedControlExample },

  // Status
  { name: 'StatusDot', category: 'Data Display', Example: StatusDotExample },

  // Overlay
  { name: 'Modal', category: 'Overlay', Example: ModalExample },
  { name: 'CommandPalette', category: 'Overlay', Example: CommandPaletteExample },
];

export const categories = [...new Set(componentRegistry.map((c) => c.category))];
