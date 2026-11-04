import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { GameActions, GameSection } from '../game-section/index';
import { createScreenSlot } from '../screen-slot';
import styles from './game-setup-panel.module.css';

export type GameSetupPanelProps = {
  title: JSX.Element;
  description?: JSX.Element | undefined;
  children?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  details?: JSX.Element | undefined;
  /**
   * What the person brings to the choice (their ratings), in the same card:
   * a column beside the choices and commands when the game's column is
   * wide, under them past a hairline when it is not. One card, never two.
   */
  aside?: JSX.Element | undefined;
  /** Stretch to the foot of its column beside a wide board (`GameSection`). */
  fill?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** Choices followed by commands, then secondary options, for any game mode. */
export function GameSetupPanel(props: GameSetupPanelProps): JSX.Element {
  const aside = createScreenSlot(() => props.aside);
  return (
    <GameSection
      title={props.title}
      description={props.description}
      dataSet={{ component: 'GameSetupPanel', ...props.dataSet }}
      footer={props.details}
      fill={props.fill}
    >
      <Show
        when={aside.present()}
        fallback={
          <>
            {props.children}
            <GameActions>{props.actions}</GameActions>
          </>
        }
      >
        <div class={styles['setupSplit']} data-setup-split="true">
          <div class={styles['setupMain']}>
            {props.children}
            <GameActions>{props.actions}</GameActions>
          </div>
          <div class={styles['setupAside']}>{aside.content()}</div>
        </div>
      </Show>
    </GameSection>
  );
}
