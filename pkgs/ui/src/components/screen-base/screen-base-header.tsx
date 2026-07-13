/**
 * App screen header: composes the {@link TopBar} primitive. Every screen
 * gets the same chrome height because `TopBar`'s content height is locked.
 *
 * Slot mapping:
 *   - `leading`  -> caller-supplied leading content + auto back button.
 *   - `center`   -> page title (from breadcrumbs).
 *   - `trailing` -> responsive action bar (actions + account menu end slot).
 */

import {
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ActionBar, screenBaseActionToActionBarItem } from '../action-bar';
import type { ActionBarItem, ActionBarTextAction } from '../action-bar';
import { useActionBarChrome } from '../../theme';
import { BackIconButton } from '../back-icon-button';
import { Box } from '../box';
import { TopBar, TopBarTitle } from '../top-bar';
import type {
  ScreenBaseAction,
  ScreenBaseHeaderProps,
} from './screen-base-types';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer `useContext` over `useSafeAreaInsets` so monorepo Metro cannot bundle two copies of the library (mismatched context). */
function useSafeAreaInsetsCompat() {
  return useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
}

function actionIntent(
  type: ScreenBaseAction['type']
): 'primary' | 'danger' | 'neutral' {
  switch (type) {
    case 'submit':
      return 'primary';
    case 'destructive':
      return 'danger';
    default:
      return 'neutral';
  }
}

function partitionScreenBaseActions(actions: ScreenBaseAction[]): {
  iconItems: ActionBarItem[];
  textActions: ActionBarTextAction[];
} {
  const iconItems: ActionBarItem[] = [];
  const textActions: ActionBarTextAction[] = [];

  actions.forEach((action, index) => {
    const iconItem = screenBaseActionToActionBarItem(action, `action-${index}`);
    if (iconItem !== null) {
      iconItems.push(iconItem);
      return;
    }
    textActions.push({
      id: `text-action-${index}`,
      label: action.label,
      onPress: action.onPress,
      intent: actionIntent(action.type),
      loading: action.loading ?? false,
      disabled: action.disabled ?? false,
      ...(action.overflow !== undefined ? { overflow: action.overflow } : {}),
    });
  });

  return { iconItems, textActions };
}

type BreadcrumbItem = ScreenBaseHeaderProps['breadcrumbs'][number];

function deriveBackCrumb(
  breadcrumbs: BreadcrumbItem[]
): BreadcrumbItem | undefined {
  return breadcrumbs.length >= 2
    ? breadcrumbs[breadcrumbs.length - 2]
    : undefined;
}

function deriveHeaderLayout(breadcrumbs: BreadcrumbItem[]): {
  title: ReactNode | undefined;
  backCrumb: BreadcrumbItem | undefined;
  showBack: boolean;
} {
  const current = breadcrumbs[breadcrumbs.length - 1];
  const backCrumb = deriveBackCrumb(breadcrumbs);
  return {
    title: current?.name,
    backCrumb,
    showBack: backCrumb !== undefined && backCrumb.onPress !== undefined,
  };
}

function renderCenterSlot(title: ReactNode | undefined): ReactNode {
  if (title !== undefined && title !== null) {
    return <TopBarTitle label={title} />;
  }
  return null;
}

export function ScreenBaseHeader({
  breadcrumbs,
  actions: actionsProp,
  leading: leadingProp,
  accountMenu,
}: ScreenBaseHeaderProps) {
  const insets = useSafeAreaInsetsCompat();
  const chrome = useActionBarChrome();
  const { iconItems, textActions } = useMemo(
    () => partitionScreenBaseActions(actionsProp ?? []),
    [actionsProp]
  );
  const { title, backCrumb, showBack } = deriveHeaderLayout(breadcrumbs);

  const onBack = () => {
    backCrumb?.onPress?.();
  };

  const leadingSlot = (
    <>
      {leadingProp}
      {showBack ? <BackIconButton size={chrome.buttonSize} onPress={onBack} /> : null}
    </>
  );

  const trailingSlot =
    iconItems.length > 0 ||
    textActions.length > 0 ||
    accountMenu !== undefined ? (
      <ActionBar
        items={iconItems}
        textActions={textActions}
        endSlot={accountMenu}
        buttonSize={chrome.buttonSize}
        gap={chrome.gap}
        slotWidth={chrome.slotWidth}
        showInlineLabels={chrome.showInlineLabels}
        overflowTestID="header-overflow-menu"
      />
    ) : null;

  return (
    <Box sx={{ background: 'surface', paddingTop: insets.top }}>
      <TopBar
        safeAreaTop={false}
        centerAlign="center"
        leading={leadingSlot}
        center={renderCenterSlot(title)}
        trailing={trailingSlot}
      />
    </Box>
  );
}
