/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';
import type { IconComponent } from '../create-icon/index';
import { FloatingMenu } from '../floating-menu/index';
import type {
  FloatingMenuContent,
  FloatingMenuItemRow,
} from '../floating-menu-content';
import {
  ArrowLeftRightIcon,
  CircleCheckIcon,
  CrownIcon,
  Gamepad2Icon,
  LogOutIcon,
  MicOffIcon,
  SendIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
  VolumeXIcon,
  XIcon,
} from '../icons';
import { BotArt } from '../illustration/index';
import { spaceDataSet } from '../space-data-set';
import { useSpacePersonWords } from '../space-people-row/space-person-words';
import {
  type SpacePersonActionEntry,
  type SpacePersonActionId,
  type SpacePersonCapability,
  spacePersonActions,
} from '../space-person-actions';
import type {
  SpaceGameAction,
  SpacePerson,
  SpacePersonData,
  SpacePersonStatus,
  SpacePhase,
  SpaceRole,
} from '../space-types';

/** Wide enough for the longest action label on one line. */
const SPACE_PERSON_MENU_WIDTH = 280;

export type SpacePersonMenuProps = {
  /** The pressed entry; unset closes the menu. */
  person: SpacePerson | undefined;
  /** The pressed entry's avatar: the menu opens against it. */
  anchor: HTMLElement | null;
  viewer: SpaceRole;
  phase: SpacePhase;
  /** The entry's status now (in game, `turn` for whoever plays). */
  status?: SpacePersonStatus | undefined;
  /** The entry's data line, said in words under the name. */
  data?: SpacePersonData | undefined;
  /** The game's actions on this entry, put first. */
  gameActions?: readonly SpaceGameAction[] | undefined;
  /** The optional space actions the product can carry out; none by default. */
  capabilities?: readonly SpacePersonCapability[] | undefined;
  /** A space action was chosen for `personId`; the menu closes after it. */
  onAction: (personId: string, action: SpacePersonActionId) => void;
  onClose: () => void;
  dataSet?: ComponentDataSet | undefined;
};

const ACTION_ICON: Readonly<Record<SpacePersonActionId, IconComponent>> = {
  readyUp: CircleCheckIcon,
  notReady: XIcon,
  muteMic: MicOffIcon,
  mute: VolumeXIcon,
  seeMyDetails: UserIcon,
  leaveSeat: LogOutIcon,
  sendMessage: SendIcon,
  seeDetails: UserIcon,
  makeHost: CrownIcon,
  removeFromSpace: Trash2Icon,
  changeDifficulty: SlidersHorizontalIcon,
  swapForPerson: ArrowLeftRightIcon,
  removeBot: Trash2Icon,
  removeSeat: Trash2Icon,
  inviteFriend: UserPlusIcon,
  addBot: BotArt,
};

function useActionLabel(): (
  id: SpacePersonActionId,
  person: SpacePerson
) => string {
  const { t } = useLingui();
  return (id, person) => {
    const labels: Readonly<Record<SpacePersonActionId, string>> = {
      readyUp: t`Ready up`,
      notReady: t`Not ready`,
      muteMic: t`Mute my mic`,
      mute: t`Mute ${person.name}`,
      seeMyDetails: t`See my details`,
      leaveSeat: t`Leave seat`,
      sendMessage: t`Send message`,
      seeDetails: t`See details`,
      makeHost: t`Make host`,
      removeFromSpace: t`Remove from space`,
      changeDifficulty: t`Change difficulty`,
      swapForPerson: t`Swap for a person`,
      removeBot: t`Remove bot`,
      removeSeat: t`Remove seat`,
      inviteFriend: t`Invite a friend`,
      addBot: t`Add bot`,
    };
    return labels[id];
  };
}

/**
 * `SpacePersonMenu` -- what the viewer can do to one entry of the people
 * row, in a menu that opens against that entry's avatar, so the pointer
 * that pressed the avatar is already next to the actions. Its header is
 * the name, then the role, status and data in words, which is where the
 * badges are spelled out.
 *
 * The list comes from `spacePersonActions`: the game's actions first, then
 * the space's, then the host's own, destructive ones last in the
 * destructive ink. A toggle says its state as a word. Actions the viewer
 * cannot take are left out.
 */
export function SpacePersonMenu(props: SpacePersonMenuProps): JSX.Element {
  const { t } = useLingui();
  const words = useSpacePersonWords();
  const label = useActionLabel();
  const row = (
    entry: SpacePersonActionEntry,
    person: SpacePerson
  ): FloatingMenuItemRow => {
    const tone = entry.destructive ? 'destructive' : 'default';
    if (entry.source === 'game')
      return {
        type: 'item',
        id: `game:${entry.action.id}`,
        label: entry.action.label,
        icon: Gamepad2Icon,
        tone,
        disabled: entry.action.disabled === true,
        onClick: () => entry.action.onPress(),
        dataSet: spaceDataSet({ action: entry.action.id }, entry.action.testId),
      };
    return {
      type: 'item',
      id: entry.id,
      label: label(entry.id, person),
      subtitle: entry.on === undefined ? undefined : entry.on ? t`On` : t`Off`,
      icon: ACTION_ICON[entry.id],
      tone,
      onClick: () => props.onAction(person.id, entry.id),
      dataSet: { action: entry.id },
    };
  };
  const content = createMemo((): FloatingMenuContent => {
    const person = props.person;
    if (person === undefined) return { rows: [] };
    return {
      header: {
        title: words.name(person),
        subtitle: words.summary(person, props.status, props.data).join(' · '),
      },
      rows: spacePersonActions({
        pressed: person,
        viewer: props.viewer,
        phase: props.phase,
        game: props.gameActions,
        capabilities: props.capabilities,
      }).map((entry) => row(entry, person)),
    };
  });
  return (
    <FloatingMenu
      open={props.person !== undefined}
      onClose={() => props.onClose()}
      anchor={props.anchor}
      placement="bottom-start"
      width={SPACE_PERSON_MENU_WIDTH}
      content={content()}
      label={props.person === undefined ? undefined : words.name(props.person)}
      dataSet={{ component: 'SpacePersonMenu', ...props.dataSet }}
    />
  );
}
