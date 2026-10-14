import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { ScreenBase } from './screen-base';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenColumn } from './screen-column';
import styles from './screen-layouts.module.css';

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
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      dataSet={{ component: 'ProfileScreenLayout', ...props.dataSet }}
      surface="canvas"
      scroll
      content={() => (
        <ScreenColumn>
          <ProfileIdentity
            identity={props.identity}
            actions={props.identityActions}
          />
          {props.children}
        </ScreenColumn>
      )}
    />
  );
}
