import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import type {
  SpaceGameAction,
  SpacePerson,
} from '@pkgs/ui-root-client-ts/space-types';
import {
  frameNextDifficulty,
  frameOwnInvitation,
  frameSeatHolder,
  frameSeatOf,
} from './game-frame-setup-people';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';

/**
 * What can be done while a custom game is set up, as the setup template
 * offers it: the live actions under its command, each seat's actions in
 * its person's sheet (the space's own, mapped to the room's choices, then
 * the game's), and inviting someone who watches. A choice is sent as it is
 * pressed; a refused one shows in the frame's notice.
 */

/** Sends one choice; a refusal shows in the frame's notice, not here. */
export type FrameSetupChoose = (input: CustomGameInput) => void;

export type FrameSetupHandlers = {
  readonly choose: FrameSetupChoose;
  readonly ready: () => void;
  readonly playBot: () => void;
  readonly cancel: () => void;
  /** The space's own handling of a person action it owns. */
  readonly space: (personId: string, action: string) => void;
};

/** The choice a space action on a seat makes, or `null` for the space's own. */
function seatChoice(
  seat: FrameSetupSeat,
  action: string
): CustomGameInput | 'ready' | null {
  const side = seat.side;
  const invited = frameOwnInvitation(seat);
  if (action === 'addBot') return { operation: 'bot', side };
  if (action === 'removeBot' || action === 'swapForPerson')
    return { operation: 'open', side };
  if (action === 'removeSeat') return { operation: 'close', side };
  if (action === 'leaveSeat')
    return { operation: invited ? 'decline' : 'release', side };
  if (action === 'readyUp')
    return invited ? { operation: 'accept', side } : 'ready';
  if (action === 'notReady') return { operation: 'unready' };
  if (action === 'changeDifficulty') {
    const difficulty = frameNextDifficulty(seat);
    return difficulty === null
      ? null
      : { operation: 'difficulty', side, difficulty };
  }
  return null;
}

/**
 * A space action chosen on a people-row entry. On a seat, the seat's own
 * choices (a bot, an open or closed seat, leaving it, readiness, answering
 * an invitation); everything else, and anyone watching, goes to the space
 * with the person's own id.
 */
export function frameSetupPersonAction(
  setup: FrameSetup | null,
  handlers: FrameSetupHandlers,
  id: string,
  /** A `SpacePersonActionId`. */
  action: string
): void {
  const seat = setup === null ? undefined : frameSeatOf(setup, id);
  if (seat === undefined) {
    handlers.space(id, action);
    return;
  }
  const choice = seatChoice(seat, action);
  if (choice === 'ready') handlers.ready();
  else if (choice !== null) handlers.choose(choice);
  else handlers.space(frameSeatHolder(seat) ?? id, action);
}

function hostSeatActions(
  setup: FrameSetup,
  seat: FrameSetupSeat,
  choose: FrameSetupChoose
): SpaceGameAction[] {
  const side = seat.side;
  const kind = seat.holder.kind;
  const someoneElse = kind === 'person' && !seat.own;
  const actions: SpaceGameAction[] = [];
  const add = (
    operation: 'take' | 'local' | 'open' | 'close',
    label: string,
    tone?: 'destructive'
  ): void => {
    actions.push({
      id: operation,
      label,
      tone,
      testId: `custom-game-${side}-${operation}`,
      onPress: () => choose({ operation, side }),
    });
  };
  if (!(seat.own && kind === 'person')) add('take', t`Play this side yourself`);
  if (seat.choices?.localPlayers === true && kind !== 'local')
    add('local', t`A player on this device`);
  if (kind === 'closed' || kind === 'local' || someoneElse)
    add('open', t`Open the seat`);
  if (kind === 'local' || someoneElse)
    add('close', t`Close the seat`, 'destructive');
  if (setup.options?.clock != null)
    actions.push({
      id: 'swap',
      label: t`Swap sides`,
      testId: 'custom-game-swap',
      onPress: () => choose({ operation: 'swap' }),
    });
  return actions;
}

/** The game's actions on a seat, first in its sheet. */
function seatActions(
  setup: FrameSetup,
  seat: FrameSetupSeat,
  choose: FrameSetupChoose
): readonly SpaceGameAction[] {
  const side = seat.side;
  const actions: SpaceGameAction[] = [];
  if (seat.canSit)
    actions.push({
      id: 'claim',
      label: t`Sit here`,
      emphasis: 'primary',
      testId: `custom-game-${side}-claim`,
      onPress: () => choose({ operation: 'claim', side }),
    });
  if (seat.choices !== null)
    actions.push(...hostSeatActions(setup, seat, choose));
  if (seat.invitation?.canRevoke === true)
    actions.push({
      id: 'revoke',
      label: t`Revoke the invitation`,
      tone: 'destructive',
      testId: `custom-game-${side}-revoke`,
      onPress: () => choose({ operation: 'revoke', side }),
    });
  return actions;
}

/**
 * Inviting someone in the space to a seat that holds nobody yet (open,
 * closed, or a bot's): one row each, named as the space names them. A
 * person already seated cannot be invited.
 */
function inviteActions(
  seat: FrameSetupSeat,
  present: readonly SpacePerson[],
  choose: FrameSetupChoose
): readonly SpaceGameAction[] {
  const kind = seat.holder.kind;
  if (kind !== 'open' && kind !== 'closed' && kind !== 'bot') return [];
  const side = seat.side;
  return (seat.choices?.invitees ?? []).flatMap((invitee) => {
    const person = present.find((each) => each.id === invitee.person);
    if (invitee.disabled || person === undefined || person.you === true)
      return [];
    const name = person.name;
    return [
      {
        id: `invite-${invitee.person}`,
        label: t`Invite ${name}`,
        testId: `custom-game-${side}-invitable`,
        onPress: () =>
          choose({ operation: 'invite', side, person: invitee.person }),
      },
    ];
  });
}

/**
 * The game's own actions on a people-row entry: a seat's choices, and
 * inviting someone in the space to it. Someone watching has none.
 */
export function frameSetupGameActions(
  setup: FrameSetup | null,
  present: readonly SpacePerson[],
  choose: FrameSetupChoose,
  person: SpacePerson
): readonly SpaceGameAction[] {
  const seat = setup === null ? undefined : frameSeatOf(setup, person.id);
  if (setup === null || seat === undefined) return [];
  return [
    ...seatActions(setup, seat, choose),
    ...inviteActions(seat, present, choose),
  ];
}

/** Before any game: play the bots at once, or set one up with people. */
function startActions(
  props: { readonly playerCount: number },
  handlers: FrameSetupHandlers
): readonly SpaceGameAction[] {
  return [
    {
      id: 'play-bot',
      label: props.playerCount > 2 ? t`Play against bots` : t`Play a bot`,
      emphasis: 'primary',
      testId: 'custom-game-play-bot',
      onPress: () => handlers.playBot(),
    },
    {
      id: 'create',
      label: t`Play with people`,
      testId: 'custom-game-create',
      onPress: () => handlers.choose({ operation: 'create' }),
    },
  ];
}

/**
 * Under the setup's command: answering the viewer's own invitation, taking
 * an open seat, and calling the game off (confirmed first).
 */
function setupActions(
  setup: FrameSetup,
  canCancel: boolean,
  handlers: FrameSetupHandlers
): readonly SpaceGameAction[] {
  const actions: SpaceGameAction[] = [];
  const invited = setup.seats.find(frameOwnInvitation);
  if (invited !== undefined) {
    const side = invited.side;
    actions.push(
      {
        id: 'accept',
        label: t`Accept`,
        emphasis: 'primary',
        testId: `custom-game-${side}-accept`,
        onPress: () => handlers.choose({ operation: 'accept', side }),
      },
      {
        id: 'decline',
        label: t`Decline`,
        testId: `custom-game-${side}-decline`,
        onPress: () => handlers.choose({ operation: 'decline', side }),
      }
    );
  }
  const open = setup.takeSeat;
  if (open !== null)
    actions.push({
      id: 'take-seat',
      label: t`Take a seat`,
      emphasis: 'primary',
      testId: 'custom-game-take-seat',
      onPress: () => handlers.choose({ operation: 'claim', side: open }),
    });
  if (canCancel)
    actions.push({
      id: 'cancel',
      label: t`Cancel game`,
      tone: 'destructive',
      testId: 'custom-game-cancel',
      onPress: () => handlers.cancel(),
    });
  return actions;
}

/** The setup's live actions for the phase: starting a game, or setting it up. */
export function frameSetupLiveActions(
  props: {
    readonly setup: FrameSetup | null;
    readonly canCreate: boolean;
    readonly playerCount: number;
    readonly canCancel: boolean;
  },
  handlers: FrameSetupHandlers
): readonly SpaceGameAction[] {
  if (props.setup !== null)
    return setupActions(props.setup, props.canCancel, handlers);
  return props.canCreate ? startActions(props, handlers) : [];
}
