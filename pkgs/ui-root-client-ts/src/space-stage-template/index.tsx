/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { type SpaceScreenChrome, SpaceShell } from '../space-shell/index';
import type { SpaceRole } from '../space-types';

export type SpaceStageTemplateProps = SpaceScreenChrome & {
  role: SpaceRole;
  /** `scroll` (default) for a page; `fixed` when the content owns the room. */
  stage?: 'scroll' | 'fixed' | undefined;
  /** The page. */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `SpaceStageTemplate` -- any space screen whose stage is its own page:
 * choosing a game (`SpaceLauncher`), a game's choices, history, settings,
 * puzzles, a matchmaking search. The top bar comes from the space; the
 * page scrolls in the stage.
 */
export function SpaceStageTemplate(
  props: SpaceStageTemplateProps
): JSX.Element {
  return (
    <SpaceShell
      spaceName={props.spaceName}
      title={props.title}
      role={props.role}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onMembers={props.onMembers}
      onSettings={props.onSettings}
      onMinimize={props.onMinimize}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      notice={props.notice}
      testIds={props.testIds}
      stage={props.stage}
      dataSet={{ component: 'SpaceStageTemplate', ...props.dataSet }}
    >
      {props.children}
    </SpaceShell>
  );
}
