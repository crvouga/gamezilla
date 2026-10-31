import type { JSX } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import type { ScreenBaseProps } from '../screen-base-types';

export type MenuScreenProps = Pick<
  ScreenBaseProps,
  | 'screenId'
  | 'breadcrumbs'
  | 'actions'
  | 'leading'
  | 'dataSet'
  | 'renderActionsMenu'
> & {
  /** Compose MenuSection / MenuList; their rows retain native semantics. */
  children: JSX.Element;
};

/** Routed preferences and destination groups, with one scrolling column. */
export function MenuScreen(props: MenuScreenProps): JSX.Element {
  return (
    <ContentScreen
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      leading={props.leading}
      renderActionsMenu={props.renderActionsMenu}
      width="menu"
      dataSet={{ component: 'MenuScreen', ...props.dataSet }}
    >
      {props.children}
    </ContentScreen>
  );
}
