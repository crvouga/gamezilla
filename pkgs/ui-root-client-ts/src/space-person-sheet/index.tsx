/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { MenuList } from '../menu-list/index';
import { MenuRow } from '../menu-row/index';
import { ResponsiveSurface } from '../responsive-surface/index';
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
import { StackVertical } from '../stack/index';
import { P } from '../text/index';

export type SpacePersonSheetProps = {
  /** The pressed entry; unset closes the sheet. */
  person: SpacePerson | undefined;
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
  /** A space action was chosen for `personId`; the sheet has closed. */
  onAction: (personId: string, action: SpacePersonActionId) => void;
  onClose: () => void;
  dataSet?: ComponentDataSet | undefined;
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

function ActionRow(props: {
  entry: SpacePersonActionEntry;
  person: SpacePerson;
  onAction: SpacePersonSheetProps['onAction'];
  onClose: () => void;
}): JSX.Element {
  const label = useActionLabel();
  const run = (): void => {
    const entry = props.entry;
    props.onClose();
    if (entry.source === 'game') entry.action.onPress();
    else props.onAction(props.person.id, entry.id);
  };
  const on = () =>
    props.entry.source === 'space' ? props.entry.on : undefined;
  return (
    <MenuRow
      title={
        props.entry.source === 'game'
          ? props.entry.action.label
          : label(props.entry.id, props.person)
      }
      tone={props.entry.destructive ? 'destructive' : 'default'}
      value={
        <Show when={on() !== undefined}>
          <Show when={on()} fallback={<Trans>Off</Trans>}>
            <Trans>On</Trans>
          </Show>
        </Show>
      }
      hideChevron
      disabled={
        props.entry.source === 'game' && props.entry.action.disabled === true
      }
      onClick={run}
      dataSet={
        props.entry.source === 'game'
          ? spaceDataSet(
              { action: props.entry.action.id },
              props.entry.action.testId
            )
          : { action: props.entry.id }
      }
    />
  );
}

/**
 * `SpacePersonSheet` -- what the viewer can do to one entry of the people
 * row, in a sheet over the stage (a centered dialog on wide layouts). It
 * opens with the name, then the role, status and data in words, which is
 * where the badges are spelled out.
 *
 * The list comes from `spacePersonActions`: the game's actions first, then
 * the space's, then the host's own, destructive ones last in the
 * destructive ink. A toggle says its state as a word. Actions the viewer
 * cannot take are left out.
 */
export function SpacePersonSheet(props: SpacePersonSheetProps): JSX.Element {
  const words = useSpacePersonWords();
  const entries = createMemo(() => {
    const person = props.person;
    if (person === undefined) return [];
    return spacePersonActions({
      pressed: person,
      viewer: props.viewer,
      phase: props.phase,
      game: props.gameActions,
      capabilities: props.capabilities,
    });
  });
  return (
    <ResponsiveSurface
      visible={props.person !== undefined}
      onClose={() => props.onClose()}
      title={props.person === undefined ? undefined : words.name(props.person)}
      size="small"
      dataSet={{ component: 'SpacePersonSheet', ...props.dataSet }}
    >
      <Show when={props.person}>
        {(person) => (
          <StackVertical gap="md">
            <P variant="caption">
              {words.summary(person(), props.status, props.data).join(' · ')}
            </P>
            <MenuList>
              <For each={entries()}>
                {(entry) => (
                  <ActionRow
                    entry={entry}
                    person={person()}
                    onAction={props.onAction}
                    onClose={props.onClose}
                  />
                )}
              </For>
            </MenuList>
          </StackVertical>
        )}
      </Show>
    </ResponsiveSurface>
  );
}
