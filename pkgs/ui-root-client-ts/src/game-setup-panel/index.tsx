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
   * What the person brings to the choice (their ratings), in the same card,
   * under the choices and commands past a hairline. One card, never two,
   * held to a form's measure beside nothing else (`GameLayout`).
   */
  aside?: JSX.Element | undefined;
  /**
   * With `aside`, wide: the details stand as the card's third column,
   * beside the choice and the aside, instead of its foot, so a short choice
   * (a search) fills the game column rather than a corner of it.
   */
  detailsBeside?: boolean | undefined;
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
        <div
          class={styles['setupSplit']}
          data-setup-split="true"
          data-details-beside={props.detailsBeside === true}
        >
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
