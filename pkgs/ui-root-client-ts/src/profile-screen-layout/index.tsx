import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';
import { createScreenSlot } from '../screen-slot';

export type ProfileScreenLayoutProps = Pick<
  ScreenBaseProps,
  'screenId' | 'breadcrumbs' | 'actions' | 'dataSet'
> & {
  identity: JSX.Element;
  identityActions?: JSX.Element | undefined;
  children?: JSX.Element | undefined;
};

/** Shared identity grouping for an owner profile or another person's profile. */
export function ProfileIdentity(props: {
  identity: JSX.Element;
  actions?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <div
      class={styles['identity']}
      {...dataAttrs({ component: 'ProfileIdentity' })}
    >
      {props.identity}
      {props.actions}
    </div>
  );
}

/**
 * Identity first, then the supporting sections. On a phone they stack in
 * one column with the identity centered. Where the column is wide enough
 * (a tablet or desktop), the identity takes its own column on the left and
 * the sections run beside it, so a profile reads as one composed page
 * rather than a narrow strip. A profile without sections keeps one column.
 */
export function ProfileScreenLayout(
  props: ProfileScreenLayoutProps
): JSX.Element {
  const sections = createScreenSlot(() => props.children);
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
          data-split={sections.present() ? 'true' : 'false'}
        >
          <div class={styles['profileAside']}>
            <ProfileIdentity
              identity={props.identity}
              actions={props.identityActions}
            />
          </div>
          <div class={styles['profileSections']}>{sections.content()}</div>
        </div>
      </div>
    </ContentScreen>
  );
}
