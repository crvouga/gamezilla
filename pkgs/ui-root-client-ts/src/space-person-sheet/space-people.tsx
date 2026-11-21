/** @jsxImportSource solid-js */

import { createMemo, createSignal, type JSX } from 'solid-js';
import { SpacePeopleRow } from '../space-people-row/index';
import type {
  SpacePersonActionId,
  SpacePersonCapability,
} from '../space-person-actions';
import type {
  SpaceGameAction,
  SpaceGameSeat,
  SpacePerson,
  SpacePersonData,
  SpacePhase,
  SpaceRole,
} from '../space-types';
import { SpacePersonSheet } from './index';

export type SpacePeopleProps = {
  people: readonly SpacePerson[];
  viewer: SpaceRole;
  phase: SpacePhase;
  data?: ((person: SpacePerson) => SpacePersonData | undefined) | undefined;
  seat?: ((person: SpacePerson) => SpaceGameSeat | undefined) | undefined;
  gameActions?:
    | ((person: SpacePerson, viewer: SpaceRole) => readonly SpaceGameAction[])
    | undefined;
  onPersonAction: (personId: string, action: SpacePersonActionId) => void;
  onInvite?: (() => void) | undefined;
  /** The optional space actions the product can carry out; none by default. */
  capabilities?: readonly SpacePersonCapability[] | undefined;
};

/**
 * `SpacePeople` -- the people row with each entry's sheet: pressing a cell
 * opens that entry's actions, and the cell shows it is open. What the
 * templates put in row 2.
 */
export function SpacePeople(props: SpacePeopleProps): JSX.Element {
  const [openId, setOpenId] = createSignal<string | undefined>(undefined);
  const open = createMemo(() =>
    props.people.find((person) => person.id === openId())
  );
  const seat = () => {
    const person = open();
    return person === undefined ? undefined : props.seat?.(person);
  };
  const data = () => {
    const person = open();
    if (person === undefined) return undefined;
    return props.phase === 'inGame' ? seat()?.data : props.data?.(person);
  };
  const status = () =>
    props.phase === 'inGame' && seat()?.turn === true ? 'turn' : open()?.status;
  return (
    <>
      <SpacePeopleRow
        people={props.people}
        phase={props.phase}
        data={props.data}
        seat={props.seat}
        openId={openId()}
        onPerson={setOpenId}
        onInvite={props.onInvite}
      />
      <SpacePersonSheet
        person={open()}
        viewer={props.viewer}
        phase={props.phase}
        status={status()}
        data={data()}
        gameActions={(() => {
          const person = open();
          return person === undefined
            ? undefined
            : props.gameActions?.(person, props.viewer);
        })()}
        capabilities={props.capabilities}
        onAction={(id, action) => props.onPersonAction(id, action)}
        onClose={() => setOpenId(undefined)}
      />
    </>
  );
}
