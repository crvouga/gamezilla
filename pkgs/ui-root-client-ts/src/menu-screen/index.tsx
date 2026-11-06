import type { JSX } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import {
  type MenuSectionLayout,
  MenuSectionLayoutProvider,
} from '../menu-section/layout-context';
import type { ScreenBaseProps } from '../screen-base-types';
import { useLayoutMode } from '../use-layout-mode';

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

/**
 * Routed preferences and destination groups, with one scrolling column. On
 * desktop its sections put their labels beside their rows.
 */
export function MenuScreen(props: MenuScreenProps): JSX.Element {
  const mode = useLayoutMode();
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
      <MenuSectionLayoutProvider
        layout={(): MenuSectionLayout =>
          mode() === 'wide' ? 'aside' : 'stacked'
        }
      >
        {props.children}
      </MenuSectionLayoutProvider>
    </ContentScreen>
  );
}
