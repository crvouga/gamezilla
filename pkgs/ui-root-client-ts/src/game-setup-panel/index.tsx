import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { GameActions, GameSection } from '../game-section/index';

export type GameSetupPanelProps = {
  title: JSX.Element;
  description?: JSX.Element | undefined;
  children?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  details?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** Choices followed by commands, then secondary options, for any game mode. */
export function GameSetupPanel(props: GameSetupPanelProps): JSX.Element {
  return (
    <GameSection
      title={props.title}
      description={props.description}
      dataSet={{ component: 'GameSetupPanel', ...props.dataSet }}
      footer={props.details}
    >
      {props.children}
      <GameActions>{props.actions}</GameActions>
    </GameSection>
  );
}
