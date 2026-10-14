import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { GameLayout } from './game-screen';
import { GameActions } from './game-section';

export type GameSessionLayoutProps = {
  notices?: JSX.Element | undefined;
  /** Setup, invitation, waiting, or rematch controls, owned by the feature. */
  setup?: JSX.Element | undefined;
  children: JSX.Element;
  status?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  /** Record, spectators, ratings, or other supporting information. */
  aside?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function SessionStage(props: GameSessionLayoutProps): JSX.Element {
  return (
    <>
      {props.children}
      {props.status}
      <GameActions>{props.actions}</GameActions>
    </>
  );
}

/** Shared custom / matched game composition, including setup and results. */
export function GameSessionLayout(props: GameSessionLayoutProps): JSX.Element {
  return (
    <div
      class="box gap-4 min-w-0"
      {...dataAttrs({ component: 'GameSessionLayout', ...props.dataSet })}
    >
      {props.notices}
      {props.setup}
      <GameLayout aside={props.aside}>
        <SessionStage {...props} />
      </GameLayout>
    </div>
  );
}
