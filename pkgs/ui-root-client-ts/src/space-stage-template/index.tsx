/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { SpacePeople } from '../space-person-sheet/space-people';
import { type SpaceScreenChrome, SpaceShell } from '../space-shell/index';
import type {
  SpaceGameSeat,
  SpacePerson,
  SpacePersonData,
  SpacePhase,
  SpaceRole,
} from '../space-types';

export type SpaceStageTemplateProps = SpaceScreenChrome & {
  role: SpaceRole;
  /** What the space is doing: decides the people row's badges and Invite. */
  phase: SpacePhase;
  /** Everyone in the space (and any `remote` player). */
  people: readonly SpacePerson[];
  /** Each person's data line out of game. */
  data?: ((person: SpacePerson) => SpacePersonData | undefined) | undefined;
  /** Each person's seat in game. */
  seat?: ((person: SpacePerson) => SpaceGameSeat | undefined) | undefined;
  /** `scroll` (default) for a page; `fixed` when the content owns the room. */
  stage?: 'scroll' | 'fixed' | undefined;
  /** Row 3: the page. */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `SpaceStageTemplate` -- any space screen whose stage is its own page:
 * choosing a game (`SpaceLauncher`), a game's choices, history, settings,
 * puzzles, a matchmaking search. Row 1 and the people row (with each
 * person's sheet) come from the space; the page scrolls in the stage.
 */
export function SpaceStageTemplate(
  props: SpaceStageTemplateProps
): JSX.Element {
  return (
    <SpaceShell
      spaceName={props.spaceName}
      role={props.role}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onSettings={props.onSettings}
      menu={props.menu}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      notice={props.notice}
      testIds={props.testIds}
      stage={props.stage}
      dataSet={{ component: 'SpaceStageTemplate', ...props.dataSet }}
      people={
        <SpacePeople
          people={props.people}
          viewer={props.role}
          phase={props.phase}
          data={props.data}
          seat={props.seat}
          capabilities={props.personCapabilities}
          onPersonAction={props.onPersonAction}
          onInvite={props.onInvite}
        />
      }
    >
      {props.children}
    </SpaceShell>
  );
}
