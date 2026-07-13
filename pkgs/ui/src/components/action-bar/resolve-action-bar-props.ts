import type { FloatingMenuHeaderSpec } from '../floating-menu';
import type { ActionBarOverflowTriggerSpec } from './action-bar-parts';
import type { ActionBarItem } from './partition-action-bar-items';
import type {
  ActionBarAlign,
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-types';

const DEFAULT_BUTTON_SIZE = 36;
const DEFAULT_GAP = 8;

export type ResolvedActionBarProps = {
  items: readonly ActionBarItem[];
  textActions: readonly ActionBarTextAction[];
  endSlot: unknown;
  align: ActionBarAlign;
  overflow: ActionBarOverflowMode;
  overflowTrigger: ActionBarOverflowTriggerSpec | undefined;
  overflowMenuHeader: FloatingMenuHeaderSpec | undefined;
  buttonSize: number;
  gap: number;
  slotWidth: number;
  showInlineLabels: boolean;
  overflowTestID: string | undefined;
};

export function resolveActionBarProps(props: {
  items: readonly ActionBarItem[];
  textActions?: readonly ActionBarTextAction[];
  endSlot?: unknown;
  align?: ActionBarAlign;
  overflow?: ActionBarOverflowMode;
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  overflowMenuHeader?: FloatingMenuHeaderSpec;
  buttonSize?: number;
  gap?: number;
  slotWidth?: number;
  showInlineLabels?: boolean;
  overflowTestID?: string;
}): ResolvedActionBarProps {
  const buttonSize = props.buttonSize ?? DEFAULT_BUTTON_SIZE;
  return {
    items: props.items,
    textActions: props.textActions ?? [],
    endSlot: props.endSlot,
    align: props.align ?? 'end',
    overflow: props.overflow ?? 'auto',
    overflowTrigger: props.overflowTrigger,
    overflowMenuHeader: props.overflowMenuHeader,
    buttonSize,
    gap: props.gap ?? DEFAULT_GAP,
    slotWidth: props.slotWidth ?? buttonSize,
    showInlineLabels: props.showInlineLabels === true,
    overflowTestID: props.overflowTestID,
  };
}
