import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';

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

/** Identity is centered once; supporting sections share the normal measure. */
export function ProfileScreenLayout(
  props: ProfileScreenLayoutProps
): JSX.Element {
  return (
    <ContentScreen
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      width="menu"
      dataSet={{ component: 'ProfileScreenLayout', ...props.dataSet }}
    >
      <ProfileIdentity
        identity={props.identity}
        actions={props.identityActions}
      />
      {props.children}
    </ContentScreen>
  );
}
