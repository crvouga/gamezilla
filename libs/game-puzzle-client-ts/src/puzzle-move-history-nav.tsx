import type { PuzzleNavIntent } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { PUZZLE_NAV_INTENT } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { t } from '@lingui/core/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';

const ICON_SIZE = 14;

export type PuzzleMoveNavProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  /**
   * The play screen already offers step back / forward in its bottom action
   * bar, so only the review surface renders them here as well.
   */
  showStepControls: boolean;
  onNavigate: (intent: PuzzleNavIntent) => void;
};

type NavSlot = {
  readonly intent: PuzzleNavIntent;
  readonly icon: IconComponent;
  readonly label: string;
  readonly disabled: boolean;
  readonly step: boolean;
};

function navSlots(props: PuzzleMoveNavProps): readonly NavSlot[] {
  return [
    {
      intent: PUZZLE_NAV_INTENT.start,
      icon: ChevronsLeftIcon,
      label: t`Jump to start`,
      disabled: !props.canGoBack,
      step: false,
    },
    {
      intent: PUZZLE_NAV_INTENT.back,
      icon: ChevronLeftIcon,
      label: t`Previous move`,
      disabled: !props.canGoBack,
      step: true,
    },
    {
      intent: PUZZLE_NAV_INTENT.forward,
      icon: ChevronRightIcon,
      label: t`Next move`,
      disabled: !props.canGoForward,
      step: true,
    },
    {
      intent: PUZZLE_NAV_INTENT.end,
      icon: ChevronsRightIcon,
      label: t`Jump to end`,
      disabled: !props.canGoForward,
      step: false,
    },
  ];
}

function NavButton(props: {
  slot: NavSlot;
  onNavigate: (intent: PuzzleNavIntent) => void;
}): JSX.Element {
  const Icon = props.slot.icon;
  return (
    <Pressable
      align="center"
      justify="center"
      paddingX="xs"
      radius="sm"
      disabled={props.slot.disabled}
      aria-label={props.slot.label}
      testId={`chess-puzzle-move-nav-${props.slot.intent}`}
      onPress={() => props.onNavigate(props.slot.intent)}
    >
      <Icon size={ICON_SIZE} />
    </Pressable>
  );
}

/**
 * §7 jump-to-start / jump-to-end (plus step back / forward on the review
 * surface) flanking the move list.
 */
export function PuzzleMoveNav(props: {
  side: 'leading' | 'trailing';
  nav: PuzzleMoveNavProps;
}): JSX.Element {
  const slots = (): readonly NavSlot[] => {
    const leading = props.side === 'leading';
    return navSlots(props.nav).filter((slot) => {
      if (!props.nav.showStepControls && slot.step) return false;
      const isLeading =
        slot.intent === PUZZLE_NAV_INTENT.start ||
        slot.intent === PUZZLE_NAV_INTENT.back;
      return isLeading === leading;
    });
  };
  return (
    <StackHorizontal align="center">
      <For each={slots()}>
        {(slot) => <NavButton slot={slot} onNavigate={props.nav.onNavigate} />}
      </For>
    </StackHorizontal>
  );
}
