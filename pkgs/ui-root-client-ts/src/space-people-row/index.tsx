/** @jsxImportSource @solidjs/web */

import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { For, Show } from 'solid-js';
import { Avatar } from '../avatar/index';
import { GameSeatSwatch } from '../game-seat-swatch/index';
import { PlusIcon } from '../icons';
import { spaceDataSet } from '../space-data-set';
import type {
  SpaceGameSeat,
  SpacePerson,
  SpacePersonData,
  SpacePhase,
} from '../space-types';
import styles from './space-people-row.module.css';
import { SpacePersonBadges } from './space-person-badges';
import { useSpacePersonWords } from './space-person-words';

export {
  type SpacePersonWords,
  useSpacePersonWords,
} from './space-person-words';

export type SpacePersonCellProps = {
  person: SpacePerson;
  phase: SpacePhase;
  /** The data line: a game's setup data out of game. */
  data?: SpacePersonData | undefined;
  /** In game: the player's color, turn and data line (wins over `data`). */
  seat?: SpaceGameSeat | undefined;
  /** This person's menu is open. */
  expanded?: boolean | undefined;
  /** Pressed; `avatar` is what the entry's menu opens against. */
  onPress: (avatar: HTMLElement) => void;
  dataSet?: ComponentDataSet | undefined;
};

function CellAvatar(props: {
  person: SpacePerson;
  phase: SpacePhase;
  seat: SpaceGameSeat | undefined;
}): JSX.Element {
  const kind = () => {
    const held = props.person.kind;
    if (held === 'openSeat') return 'emptySeat';
    return held === 'remote' ? 'person' : held;
  };
  return (
    <Avatar
      kind={kind()}
      size={48}
      you={props.person.you}
      initials={props.person.initials}
      tintKey={props.person.tintKey}
      uri={props.person.uri}
      svg={props.person.svg}
      seatColor={props.phase === 'inGame' ? props.seat?.color : undefined}
      accentRing={props.phase !== 'inGame' && props.person.host === true}
    />
  );
}

function DataLine(props: {
  data: SpacePersonData | undefined;
  on: boolean;
}): JSX.Element {
  return (
    <span
      class={`text textLabel ${styles['data']}`}
      data-on={String(props.on)}
      aria-hidden="true"
    >
      <Show when={props.data?.swatch}>
        {(look) => (
          <span class={styles['swatch']}>
            <GameSeatSwatch look={look()} />
          </span>
        )}
      </Show>
      <Show when={props.data?.value}>{(value) => <span>{value()}</span>}</Show>
    </span>
  );
}

/**
 * `SpacePersonCell` -- one entry of a space's people row, a fixed 64 x 88
 * button: the avatar with its badges (the host's crown, a status badge
 * whose shape says the status, the muted microphone), one name line ("You"
 * for the viewer) and one data line that stays reserved when empty.
 *
 * Out of game the host wears the accent ring; in game every player's ring
 * is their color (`seat.color`) and the crown alone marks the host. Whoever
 * plays now gets the turn badge and their data line in full ink. The
 * button's accessible name and tooltip say every badge in words; pressing
 * it opens that entry's actions (`SpacePersonMenu`) against the avatar.
 */
export function SpacePersonCell(props: SpacePersonCellProps): JSX.Element {
  const words = useSpacePersonWords();
  const turn = () => props.phase === 'inGame' && props.seat?.turn === true;
  const status = () => (turn() ? 'turn' : props.person.status);
  const data = () => (props.phase === 'inGame' ? props.seat?.data : props.data);
  const said = () =>
    [
      words.name(props.person),
      ...words.summary(props.person, status(), data()),
    ].join(', ');
  let face: HTMLElement | undefined;
  return (
    <SdkButton
      type="button"
      class={styles['cell']}
      aria-label={said()}
      title={said()}
      aria-haspopup="menu"
      aria-expanded={props.expanded === true ? 'true' : 'false'}
      onClick={(event) => props.onPress(face ?? event.currentTarget)}
      data-person={props.person.id}
      data-kind={props.person.kind}
      data-host={props.person.host === true ? 'true' : undefined}
      data-status={status()}
      {...dataAttrs(
        spaceDataSet(
          { component: 'SpacePersonCell', ...props.dataSet },
          props.person.testId
        )
      )}
    >
      <span
        class={styles['face']}
        ref={(el) => {
          face = el;
        }}
      >
        <CellAvatar
          person={props.person}
          phase={props.phase}
          seat={props.seat}
        />
        <SpacePersonBadges
          host={props.person.host === true}
          status={status()}
          muted={props.person.muted === true}
        />
      </span>
      <span
        class={`text textCaption ${styles['name']}`}
        data-quiet={String(props.person.kind === 'openSeat')}
        aria-hidden="true"
      >
        {words.name(props.person)}
      </span>
      <DataLine data={data()} on={turn()} />
    </SdkButton>
  );
}

/** The Invite cell at the end of the row: a secondary control, never primary. */
function InviteCell(props: { onInvite: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <SdkButton
      type="button"
      class={styles['cell']}
      aria-label={t`Invite`}
      onClick={() => props.onInvite()}
      {...dataAttrs({ component: 'SpaceInviteCell' })}
    >
      <span class={styles['face']}>
        <span class="box" aria-hidden="true">
          <Avatar kind="emptySeat" size={48} />
        </span>
        <span class={styles['plus']} aria-hidden="true">
          <PlusIcon size={22} color="textSecondary" />
        </span>
      </span>
      <span class={`text textCaption ${styles['name']}`} data-quiet="true">
        <Trans>Invite</Trans>
      </span>
      <span class={`text textLabel ${styles['data']}`} />
    </SdkButton>
  );
}

export type SpacePeopleRowProps = {
  people: readonly SpacePerson[];
  phase: SpacePhase;
  /** Each person's data line out of game (`SpaceGameSetup.personData`). */
  data?: ((person: SpacePerson) => SpacePersonData | undefined) | undefined;
  /** Each person's seat in game (`SpaceGamePlay.seat`). */
  seat?: ((person: SpacePerson) => SpaceGameSeat | undefined) | undefined;
  /** The entry whose menu is open. */
  openId?: string | undefined;
  /** An entry was pressed; `avatar` is what its menu opens against. */
  onPerson: (id: string, avatar: HTMLElement) => void;
  /** Shows the Invite cell at the end; never while a game runs. */
  onInvite?: (() => void) | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `SpacePeopleRow` -- row 2 of a space: one `SpacePersonCell` per person,
 * bot and open seat, then Invite (hidden in game). One fixed height on
 * every screen; when more people are present than fit it scrolls sideways
 * and never wraps. The only place a person's identity and status appear.
 */
export function SpacePeopleRow(props: SpacePeopleRowProps): JSX.Element {
  const { t } = useLingui();
  return (
    <section
      class={styles['row']}
      aria-label={t`People in this space`}
      {...dataAttrs({ component: 'SpacePeopleRow', ...props.dataSet })}
    >
      <For each={props.people}>
        {(person) => (
          <SpacePersonCell
            person={person}
            phase={props.phase}
            data={props.data?.(person)}
            seat={props.seat?.(person)}
            expanded={props.openId === person.id}
            onPress={(avatar) => props.onPerson(person.id, avatar)}
          />
        )}
      </For>
      <Show when={props.phase !== 'inGame' ? props.onInvite : undefined}>
        {(onInvite) => <InviteCell onInvite={onInvite()} />}
      </Show>
    </section>
  );
}
