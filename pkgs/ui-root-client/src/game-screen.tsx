import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';
import { ScreenBase } from './screen-base';
import type { ScreenBaseBreadcrumb } from './screen-base-types';

/** Shared screen shell; games supply their own content and navigation. */
export function GameScreen(props: {
  screenId: string;
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  children: JSX.Element;
}): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      scroll
      surface="canvas"
      content={() => (
        <div
          class={styles['screen']}
          {...dataAttrs({ component: 'GameScreen' })}
        >
          {props.children}
        </div>
      )}
    />
  );
}

/** A fluid stage and a supporting rail, stacked in reading order on phones. */
export function GameLayout(props: {
  children: JSX.Element;
  aside: JSX.Element;
}): JSX.Element {
  return (
    <div class={styles['layout']} {...dataAttrs({ component: 'GameLayout' })}>
      <div class={styles['stage']}>{props.children}</div>
      <div class={styles['rail']}>{props.aside}</div>
    </div>
  );
}
