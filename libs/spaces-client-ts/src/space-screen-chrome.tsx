/**
 * # Space screen chrome — the contract every space screen codes against
 *
 * Every screen shown inside a space renders ONE layout, `SpaceShell`
 * (`@pkgs/ui-root-client-ts/space-shell`), usually through a template:
 *
 * - `SpaceStageTemplate` (`…/space-stage-template`): a page in the stage
 *   (choosing a game with `SpaceLauncher`, a game's choices, history,
 *   settings, puzzles, a matchmaking search). `stage="scroll"` is the
 *   default; `fixed` when the content owns the room.
 * - `SpaceSetupTemplate` (`…/space-setup-template`): setting a game up
 *   (`board` for private setup, `watchers`, `startNote`, `readyNote`).
 * - `SpaceInGameTemplate` (`…/space-in-game-template`): a game in play
 *   (`overlay`, `result`, `aside`; more than three actions overflow into
 *   More).
 *
 * Everything the space itself supplies comes from {@link useSpaceScreenChrome},
 * mounted by {@link SpaceScreenChromeProvider} around every active space's
 * body, so any screen under the space (`@libs/game-session-client-ts`,
 * `@libs/game-matchmaking-client-ts`, `@libs/game-puzzle-client-ts`,
 * `@libs/game-menu-client-ts`) reads it:
 *
 * ```tsx
 * const chrome = useSpaceScreenChrome();
 * <SpaceStageTemplate {...chrome} phase="choosing" notice={<SpaceScreenNotice />}>
 *   <SpaceLauncher role={chrome.role} hostName={chrome.hostName} … />
 * </SpaceStageTemplate>
 * ```
 *
 * The value is a getter bag: spread it (Solid keeps the getters reactive)
 * or read `chrome.role` where it should track; never destructure it.
 *
 * - **Role.** `role` is `'host'` when the permission system lets the
 *   viewer end the space (`PERMISSION.spacesEnd`), else `'guest'`. Gate
 *   any other host-only control on its own permission (`useSpaceCan`).
 * - **People.** `people` are the people the space counts as present
 *   (`SpacePerson` from `@pkgs/ui-root-client-ts/space-types`, not the
 *   profile `SpacePerson` of `./space-person-view`): host first, the viewer
 *   `you`, avatar art in `svg`, a quiet person `status: 'away'`. A screen
 *   maps them for its phase (seated vs `watchers`, `ready`, `turn`) and
 *   may append a `kind: 'remote'` opponent who is not in the space.
 * - **Back.** `onBack` / `backLabel` follow the screen's own
 *   `DefineBackButton` (`./spaces-nav-context`): a screen overrides back
 *   by mounting one, as today. With none registered, back leaves for the
 *   spaces list (the space goes on, minimized) and the shell says
 *   "Back to spaces".
 * - **Settings.** `menu` (Share, Rename when allowed, Minimize) opens from
 *   the gear in row 1. Leave (guest) and End (host) sit in row 1 and ask
 *   to confirm through the space's own modals.
 * - **People actions.** `onPersonAction` handles `removeFromSpace` (the
 *   remove confirm), `inviteFriend` (share), `seeDetails` / `seeMyDetails`
 *   (the members list); a screen handles its own (`readyUp`, bots, seats)
 *   first and passes the rest here. `personCapabilities` is empty: Make
 *   host, Mute, Mute my mic and Send message stay hidden until built.
 * - **Notice.** Render `<SpaceScreenNotice />` as the shell's `notice`: a
 *   refused change to the space, and a guest's host gone offline.
 * - **Test ids.** `testIds` keeps the harness handles on row 1
 *   (`navBack` / `spaceBackToSpaces`, `spaceTitle`, `spaceChromeOverflow`
 *   on the gear, `spaceLeave`, `spaceEnd`); the menu rows carry
 *   `spaceShare`, `spaceRename` and `spaceClose`, and the notice
 *   `spaceHostOffline`. Game actions carry theirs in `SpaceGameAction.testId`.
 *
 * **Who draws the shell.** Migrated screens render a template and render
 * `<ClaimSpaceShell />` (`./space-shell-claim`); unmigrated screens do
 * nothing and get the default stage shell from `SpaceScreenFrame`
 * (`./space-screen-frame`), which replaces the old chrome.
 *
 * Until the old chrome (`SpaceActiveLayout`) is deleted it still renders
 * around every screen and owns the share sheet and members list these
 * callbacks open; whoever deletes it moves `SpaceShareSheet` and
 * `SpaceMembersListModal` into {@link SpaceScreenChromeProvider}, and the
 * duplicated row-1 handles disappear with it.
 */

import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  parseAvatarConfig,
  resolveAvatarSeed,
} from '@libs/profile-shared-ts/avatar-config';
import { profileAvatarSvg } from '@libs/profile-shared-ts/profile-dicebear';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import type { SpacePersonCapability } from '@pkgs/ui-root-client-ts/space-person-actions';
import type { SpaceShellTestIds } from '@pkgs/ui-root-client-ts/space-shell';
import type {
  SpaceMenuItem,
  SpaceRole,
  SpacePerson as SpaceShellPerson,
} from '@pkgs/ui-root-client-ts/space-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  getOwner,
  type JSX,
  runWithOwner,
  Show,
  useContext,
} from 'solid-js';
import { RemoveSpacePersonModal } from './remove-space-person-modal';
import { useOpenMembers } from './space-active-layout';
import { spaceBackName } from './space-chrome-trail';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import type { SpaceDetailStatus } from './space-detail-screen-view';
import type { SpacePerson } from './space-person-view';
import { useSpacePresenceFaces } from './space-presence-strip';
import { SpaceRefusedChangeNotice } from './space-refused-change-notice';
import { spaceScreenPeople } from './space-screen-people';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useSpaceShareDialog } from './space-share-dialog-context';
import {
  useSpacesNavBack,
  useSpacesNavBackLabel,
  useSpacesNavPlace,
} from './spaces-nav-context';
import { useIdleMemberIds } from './use-idle-members';
import { useSpaceCan } from './use-space-can';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpacePerson } from './use-space-people';

/** The diameter the people row draws faces at, for avatar art. */
const PEOPLE_ROW_FACE = 48;

/** Everything a space screen needs to render `SpaceShell` and its templates. */
export type SpaceScreenChromeValue = {
  readonly spaceId: string;
  /** The space's shown name (row 1). */
  readonly spaceName: string;
  readonly role: SpaceRole;
  /** The host's shown name ("bob is choosing a game"); empty until known. */
  readonly hostName: string;
  /** Who the space counts as present, host first. */
  readonly people: readonly SpaceShellPerson[];
  /** A guest's host has gone; shared features wait for them. */
  readonly hostOffline: boolean;
  /** The space's body is still being reached, or shows its content. */
  readonly status: SpaceDetailStatus;
  readonly onBack: () => void;
  /** Where back goes, when a screen registered its own back; else unset. */
  readonly backLabel: string | undefined;
  /** The space settings sheet behind row 1's gear. */
  readonly menu: readonly SpaceMenuItem[];
  readonly onLeave: () => void;
  readonly onEnd: () => void;
  /** Opens the share sheet; unset where the space has none. */
  readonly onInvite: (() => void) | undefined;
  readonly onPersonAction: (personId: string, action: string) => void;
  /** Optional person actions the product can carry out: none yet. */
  readonly personCapabilities: readonly SpacePersonCapability[];
  readonly testIds: SpaceShellTestIds;
};

const SpaceScreenChromeContext = createContext<SpaceScreenChromeValue | null>(
  null
);

/** Each present person's face, with avatar art drawn once per config. */
function usePeople(
  spaceId: Accessor<string>
): Accessor<readonly SpaceShellPerson[]> {
  const faces = useSpacePresenceFaces(spaceId);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const myId = useMyId();
  const idle = useIdleMemberIds();
  const art = new Map<string, string | undefined>();
  const svg = (person: SpacePerson): string | undefined => {
    const key = `${person.id}\n${person.avatarConfig ?? ''}`;
    if (!art.has(key)) {
      const config = parseAvatarConfig(person.avatarConfig);
      art.set(
        key,
        config === null
          ? undefined
          : profileAvatarSvg(
              { ...config, seed: resolveAvatarSeed(config, person.id) },
              PEOPLE_ROW_FACE
            )
      );
    }
    return art.get(key);
  };
  return createMemo(() =>
    spaceScreenPeople({
      faces: faces().map((face) => ({
        id: face.actor.id,
        name: face.person?.name ?? null,
        svg: face.person === null ? undefined : svg(face.person),
      })),
      hostId: host()?.profileId ?? null,
      myId: myId(),
      idle: idle(),
    })
  );
}

/**
 * `create`'s accessor, made under the caller's owner the first time it is
 * read: the people row's subscriptions and avatar art cost nothing until a
 * screen draws it.
 */
function useLazy<T>(create: () => Accessor<T>): Accessor<T> {
  const owner = getOwner();
  let made: Accessor<T> | undefined;
  return () => {
    made ??= runWithOwner(owner, create);
    if (made === undefined) throw new Error('useLazy: owner disposed');
    return made();
  };
}

/** Back: the screen's registered way back, else out to the spaces list. */
function useBack(title: Accessor<string>) {
  const { t } = useLingui();
  const sessionUi = useSpaceSessionUi();
  const registered = useSpacesNavBack();
  const label = useSpacesNavBackLabel();
  const place = useSpacesNavPlace();
  const name = createMemo(() =>
    spaceBackName({
      place: place(),
      hasBack: registered() !== null,
      backLabel: label(),
      room: title(),
    })
  );
  return {
    onBack: (): void => (registered() ?? sessionUi.onPressHome)(),
    label: (): string | undefined => {
      if (registered() === null) return undefined;
      const where = name();
      return where === undefined ? t`Back` : t`Back to ${where}`;
    },
    testId: (): string =>
      registered() === null ? Handles.spaceBackToSpaces : Handles.navBack,
  };
}

/** Row 1's settings sheet: Share, Rename when allowed, Minimize. */
function useMenu(
  canRename: Accessor<boolean>,
  onInvite: () => void
): Accessor<readonly SpaceMenuItem[]> {
  const { t } = useLingui();
  const sessionUi = useSpaceSessionUi();
  return createMemo((): readonly SpaceMenuItem[] => [
    {
      id: 'share',
      label: t`Share`,
      onPress: onInvite,
      testId: Handles.spaceShare,
    },
    ...(canRename()
      ? [
          {
            id: 'rename',
            label: t`Rename`,
            onPress: () => sessionUi.onRequestRename(),
            testId: Handles.spaceRename,
          },
        ]
      : []),
    {
      id: 'minimize',
      label: t`Minimize space`,
      onPress: () => sessionUi.onPressHome(),
      testId: Handles.spaceClose,
    },
  ]);
}

export type SpaceScreenChromeProviderProps = {
  readonly hostOffline: boolean;
  readonly status: SpaceDetailStatus;
  readonly children: JSX.Element;
};

/**
 * Provides {@link useSpaceScreenChrome} to every screen in an active space,
 * and owns the confirm it opens (removing a person). Renders nothing else.
 */
export function SpaceScreenChromeProvider(
  props: SpaceScreenChromeProviderProps
): JSX.Element {
  const sessionUi = useSpaceSessionUi();
  const spaceId = (): string => sessionUi.spaceId;
  const title = useSpaceDisplayTitle(spaceId);
  const canEnd = useSpaceCan(spaceId, PERMISSION.spacesEnd);
  const canRename = useSpaceCan(spaceId, PERMISSION.spacesRename);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostPerson = useSpacePerson(() => host()?.profileId ?? null);
  const people = useLazy(() => usePeople(spaceId));
  const back = useBack(title);
  const shareDialog = useSpaceShareDialog();
  const openMembers = useOpenMembers();
  const invite = (): void => {
    shareDialog?.setOpen(true);
  };
  const menu = useMenu(canRename, invite);
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);
  const onPersonAction = (personId: string, action: string): void => {
    if (action === 'inviteFriend') invite();
    if (action === 'seeDetails' || action === 'seeMyDetails') openMembers();
    if (action !== 'removeFromSpace') return;
    const person = people().find((each) => each.id === personId);
    if (person === undefined) return;
    setRemoving({
      id: person.id,
      name: person.name,
      avatarConfig: null,
      bot: false,
    });
  };
  const value: SpaceScreenChromeValue = {
    get spaceId() {
      return spaceId();
    },
    get spaceName() {
      return title();
    },
    get role() {
      return canEnd() ? 'host' : 'guest';
    },
    get hostName() {
      return hostPerson()?.name ?? '';
    },
    get people() {
      return people();
    },
    get hostOffline() {
      return props.hostOffline;
    },
    get status() {
      return props.status;
    },
    onBack: back.onBack,
    get backLabel() {
      return back.label();
    },
    get menu() {
      return menu();
    },
    onLeave: () => sessionUi.onRequestLeave(),
    onEnd: () => sessionUi.onRequestEnd(),
    get onInvite() {
      return shareDialog === undefined ? undefined : invite;
    },
    onPersonAction,
    personCapabilities: [],
    get testIds() {
      return {
        back: back.testId(),
        title: Handles.spaceTitle,
        settings: Handles.spaceChromeOverflow,
        leave: Handles.spaceLeave,
        end: Handles.spaceEnd,
      };
    },
  };
  return (
    <SpaceScreenChromeContext.Provider value={value}>
      {props.children}
      <Show when={removing()} keyed>
        {(person) => (
          <RemoveSpacePersonModal
            spaceId={spaceId()}
            person={person}
            onClose={() => setRemoving(null)}
          />
        )}
      </Show>
    </SpaceScreenChromeContext.Provider>
  );
}

/**
 * Provides a ready-made chrome value: for stories and tests of a screen
 * that reads {@link useSpaceScreenChrome}, without a live space.
 */
export function SpaceScreenChromeValueProvider(props: {
  readonly value: SpaceScreenChromeValue;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceScreenChromeContext.Provider value={props.value}>
      {props.children}
    </SpaceScreenChromeContext.Provider>
  );
}

/** The space's chrome for the screen in it; see the contract above. */
export function useSpaceScreenChrome(): SpaceScreenChromeValue {
  const value = useContext(SpaceScreenChromeContext);
  if (value === null) {
    throw new Error(
      'useSpaceScreenChrome must be used within SpaceScreenChromeProvider'
    );
  }
  return value;
}

/**
 * The shell's `notice`: a refused change to the space, and, for a guest,
 * that the host has gone offline. Renders nothing while there is neither.
 */
export function SpaceScreenNotice(): JSX.Element {
  const chrome = useSpaceScreenChrome();
  return (
    <>
      <Show when={chrome.hostOffline && chrome.role === 'guest'}>
        <StackVertical paddingX="lg" paddingTop="sm">
          <SpaceHostOfflineNotice />
        </StackVertical>
      </Show>
      <SpaceRefusedChangeNotice />
    </>
  );
}
