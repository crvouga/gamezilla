import type { PuzzleNavIntent } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { PUZZLE_NAV_INTENT } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { t } from '@lingui/core/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';

/**
 * The jumps and steps look as a game record's do: quiet glyphs with no
 * plate while the board shows the latest move, so they never outweigh the
 * board; each a bounded disc on the sunken well while an earlier move is
 * shown (a step forward is open), when moving through the line is the
 * control in hand.
 */
const NAV_SIZE = 36;

export type PuzzleMoveNavProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (intent: PuzzleNavIntent) => void;
};

type NavSlot = {
  readonly intent: PuzzleNavIntent;
  readonly icon: IconComponent;
  readonly label: string;
  readonly disabled: boolean;
};

function navSlots(props: PuzzleMoveNavProps): readonly NavSlot[] {
  return [
    {
      intent: PUZZLE_NAV_INTENT.start,
      icon: ChevronsLeftIcon,
      label: t`Jump to start`,
      disabled: !props.canGoBack,
    },
    {
      intent: PUZZLE_NAV_INTENT.back,
      icon: ChevronLeftIcon,
      label: t`Previous move`,
      disabled: !props.canGoBack,
    },
    {
      intent: PUZZLE_NAV_INTENT.forward,
      icon: ChevronRightIcon,
      label: t`Next move`,
      disabled: !props.canGoForward,
    },
    {
      intent: PUZZLE_NAV_INTENT.end,
      icon: ChevronsRightIcon,
      label: t`Jump to end`,
      disabled: !props.canGoForward,
    },
  ];
}

function NavButton(props: {
  slot: NavSlot;
  reviewing: boolean;
  onNavigate: (intent: PuzzleNavIntent) => void;
}): JSX.Element {
  const Icon = props.slot.icon;
  return (
    <IconButton
      label={props.slot.label}
      size={NAV_SIZE}
      background={props.reviewing ? 'surfaceMuted' : undefined}
      disabled={props.slot.disabled}
      dataSet={{ testid: `chess-puzzle-move-nav-${props.slot.intent}` }}
      onClick={() => props.onNavigate(props.slot.intent)}
    >
      <Icon />
    </IconButton>
  );
}

/**
 * §7 move review flanking the move list, the one place to move through the
 * line: jump to the start and step back before it, step forward and jump to
 * the end after it.
 */
export function PuzzleMoveNav(props: {
  side: 'leading' | 'trailing';
  nav: PuzzleMoveNavProps;
}): JSX.Element {
  const slots = (): readonly NavSlot[] => {
    const leading = props.side === 'leading';
    return navSlots(props.nav).filter((slot) => {
      const isLeading =
        slot.intent === PUZZLE_NAV_INTENT.start ||
        slot.intent === PUZZLE_NAV_INTENT.back;
      return isLeading === leading;
    });
  };
  return (
    <StackHorizontal align="center" gap="xs">
      <For each={slots()}>
        {(slot) => (
          <NavButton
            slot={slot}
            reviewing={props.nav.canGoForward}
            onNavigate={props.nav.onNavigate}
          />
        )}
      </For>
    </StackHorizontal>
  );
}
