import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { Avatar } from './avatar';
import styles from './game-ui.module.css';
import { UserIcon } from './icons';

/** Names, avatars, roles and status are supplied by the game's adapter. */
export function GamePlayerCard(props: {
  label: JSX.Element;
  name: JSX.Element;
  avatar?: JSX.Element;
  status?: JSX.Element;
  active?: boolean;
  ready?: boolean;
  children?: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <section
      class={styles['player']}
      data-active={props.active === true}
      data-ready={props.ready === true}
      {...dataAttrs({ component: 'GamePlayerCard', ...props.dataSet })}
    >
      <div class={styles['playerIdentity']}>
        <span class={styles['playerAvatar']} aria-hidden="true">
          <Show
            when={props.avatar}
            fallback={
              <Avatar icon={UserIcon} size={48} background="surfaceMuted" />
            }
          >
            {props.avatar}
          </Show>
        </span>
        <div class="box min-w-0 gap-1">
          <p class={styles['eyebrow']}>{props.label}</p>
          <div class={styles['playerName']}>{props.name}</div>
          <Show when={props.status}>
            <div class={styles['playerStatus']}>{props.status}</div>
          </Show>
        </div>
      </div>
      <Show when={props.children}>
        <div class="box gap-3">{props.children}</div>
      </Show>
    </section>
  );
}
