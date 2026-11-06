import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';
import { createScreenSlot } from '../screen-slot';

export type ProfileScreenLayoutProps = Pick<
  ScreenBaseProps,
  'screenId' | 'breadcrumbs' | 'actions' | 'dataSet'
> & {
  /**
   * The person's picture, apart from the rest of the identity. Given, a
   * profile with a `rail` draws it beside the name on every size.
   */
  avatar?: JSX.Element | undefined;
  identity: JSX.Element;
  identityActions?: JSX.Element | undefined;
  /** The main sections: what is happening now. */
  children?: JSX.Element | undefined;
  /**
   * Secondary sections, the ways elsewhere (friends, settings). After the
   * main sections on a phone; on a desktop the second of two columns
   * under the identity, beside the main sections.
   */
  rail?: JSX.Element | undefined;
};

/** Shared identity grouping for an owner profile or another person's profile. */
export function ProfileIdentity(props: {
  avatar?: JSX.Element | undefined;
  identity: JSX.Element;
  actions?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <div
      class={styles['identity']}
      {...dataAttrs({ component: 'ProfileIdentity' })}
    >
      <Show
        when={props.avatar}
        fallback={
          <>
            {props.identity}
            {props.actions}
          </>
        }
      >
        {(avatar) => (
          <>
            <div class={styles['identityAvatar']}>{avatar()}</div>
            <div class={styles['identityText']}>{props.identity}</div>
            <Show when={props.actions}>
              {(actions) => (
                <div class={styles['identityActions']}>{actions()}</div>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}

/** How the profile composes: one column, identity beside sections, or a header band over a main column and a rail. */
type ProfileArrangement = 'stack' | 'split' | 'rail';

/**
 * Identity first, then the supporting sections. On a phone they stack in
 * one column with the identity centered. Where the column is wide enough
 * (a tablet or desktop), the identity becomes a card in its own column on
 * the left, its top aligned with the first section, and the sections run
 * beside it, so a profile reads as one composed page rather than a narrow
 * strip. A profile without sections keeps one column.
 *
 * With a `rail` the page composes differently. On a desktop the identity
 * is the page's own unframed header (the picture, the name over its facts,
 * the actions right after the words), then two columns whose tops are on
 * one line: the main sections taking what is left and the rail's sections
 * in a column wide enough for their captions. A tablet's column draws the
 * identity as a band across the top (picture, name, actions in one line)
 * over the sections; on a phone everything stacks in order.
 */
export function ProfileScreenLayout(
  props: ProfileScreenLayoutProps
): JSX.Element {
  const sections = createScreenSlot(() => props.children);
  const rail = createScreenSlot(() => props.rail);
  const arrangement = (): ProfileArrangement => {
    if (rail.present()) return 'rail';
    return sections.present() ? 'split' : 'stack';
  };
  return (
    <ContentScreen
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      width="list"
      dataSet={{ component: 'ProfileScreenLayout', ...props.dataSet }}
    >
      <div class={styles['profileFrame']}>
        <div
          class={styles['profile']}
          data-split={arrangement() === 'split' ? 'true' : 'false'}
          data-rail={arrangement() === 'rail' ? 'true' : 'false'}
        >
          <div class={styles['profileAside']}>
            <ProfileIdentity
              avatar={props.avatar}
              identity={props.identity}
              actions={props.identityActions}
            />
          </div>
          <div class={styles['profileSections']}>{sections.content()}</div>
          <Show when={rail.present()}>
            <div class={styles['profileRail']}>{rail.content()}</div>
          </Show>
        </div>
      </div>
    </ContentScreen>
  );
}
