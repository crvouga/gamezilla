/**
 * Wide ScreenBase: page header row (breadcrumb trail + ActionBar + primary
 * Button) and either one Island card body or a canvas for composed islands.
 * Pull-to-refresh is not wired (no pull gesture on desktop).
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { useActionBarChrome } from '../../theme';
import { ISLAND_GAP_STEP, ISLAND_PADDING_STEP } from '../../theme/layout';
import {
  ActionBar,
  type ActionBarItem,
  type ActionBarTextAction,
  screenBaseActionToActionBarItem,
} from '../action-bar';
import { Box } from '../box';
import { Button } from '../button';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { IslandWide } from '../island/island.wide';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScreenTitleProvider } from '../screen-title';
import { ScrollView } from '../scroll-view';
import { Spacer } from '../spacer';
import {
  ScreenBasePrimaryActionMutation,
  type ScreenBasePrimaryActionRenderProps,
} from './screen-base-primary-action';
import type {
  BodyContentProps,
  ScreenBaseAction,
  ScreenBaseProps,
  ScreenBaseSurface,
} from './screen-base-types';
import { ScreenBreadcrumbTrail } from './screen-breadcrumb-trail';

const SCROLL_BOTTOM_PADDING = 24;

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

function partitionActions(actions: ScreenBaseAction[]): {
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

function lastBreadcrumbTitle(
  breadcrumbs: ScreenBaseProps['breadcrumbs']
): ReactNode {
  return breadcrumbs[breadcrumbs.length - 1]?.name;
}

function buildBodyContentProps(scroll: boolean): BodyContentProps {
  if (scroll) {
    return { sx: {} };
  }
  return { sx: { flex: 1, minHeight: 0 } };
}

function WidePrimaryButton({
  props,
}: {
  props: ScreenBasePrimaryActionRenderProps;
}): ReactNode {
  const Icon = props.icon;
  return (
    <Button
      intent="primary"
      {...props.buttonProps}
      {...(props.fabProps.testID !== undefined
        ? { testID: props.fabProps.testID }
        : {})}
      {...(Icon !== undefined ? { startIcon: <Icon size={18} /> } : {})}
    />
  );
}

function WidePageHeader({
  breadcrumbs,
  actions,
  leading,
  primaryActionProps,
}: {
  breadcrumbs: ScreenBaseProps['breadcrumbs'];
  actions: ScreenBaseAction[];
  leading: ReactNode | undefined;
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
}): ReactNode {
  const chrome = useActionBarChrome();
  const { iconItems, textActions } = partitionActions(actions);
  const hasActions = iconItems.length > 0 || textActions.length > 0;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
      }}
    >
      {leading}
      <ScreenBreadcrumbTrail breadcrumbs={breadcrumbs} />
      <Spacer />
      {hasActions ? (
        <ActionBar
          items={iconItems}
          textActions={textActions}
          buttonSize={chrome.buttonSize}
          gap={chrome.gap}
          slotWidth={chrome.slotWidth}
          showInlineLabels
          overflowTestID="header-overflow-menu"
        />
      ) : null}
      {primaryActionProps !== undefined &&
      !primaryActionProps.buttonProps.disabled ? (
        <WidePrimaryButton props={primaryActionProps} />
      ) : null}
    </Box>
  );
}

function WidePinnedFooter({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box
      sx={{
        borderColor: 'border',
        borderTopWidth: 1,
        pt: 3,
        mt: 3,
      }}
    >
      {children}
    </Box>
  );
}

function WideIslandBody({
  scroll,
  content,
  footer,
}: {
  scroll: boolean;
  content: ScreenBaseProps['content'];
  footer: ReactNode | undefined;
}): ReactNode {
  const bodyProps = buildBodyContentProps(scroll);
  const rendered = (
    <>
      {content(bodyProps)}
      {footer !== undefined ? (
        <WidePinnedFooter>{footer}</WidePinnedFooter>
      ) : null}
    </>
  );
  if (scroll) {
    return (
      <IslandWide sx={{ flex: 1, minHeight: 0, p: 0 }}>
        <ScrollView
          // The island has `p: 0`; the scroller owns the padding itself, so it
          // must not also cancel the island's edge step (that would shift the
          // content outside the clipped card).
          flushEdge={false}
          frameSx={{ flex: 1 }}
          sx={{
            flexGrow: 1,
            p: ISLAND_PADDING_STEP,
            paddingBottom: SCROLL_BOTTOM_PADDING,
          }}
        >
          {rendered}
        </ScrollView>
      </IslandWide>
    );
  }
  return (
    <IslandWide sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>{rendered}</Box>
    </IslandWide>
  );
}

function WideCanvasBody({
  scroll,
  content,
  footer,
}: {
  scroll: boolean;
  content: ScreenBaseProps['content'];
  footer: ReactNode | undefined;
}): ReactNode {
  const bodyProps = buildBodyContentProps(scroll);
  const inner = (
    <ContentEdgePaddingProvider step={0}>
      {content(bodyProps)}
      {footer !== undefined ? (
        <WidePinnedFooter>{footer}</WidePinnedFooter>
      ) : null}
    </ContentEdgePaddingProvider>
  );
  if (scroll) {
    return (
      <ScrollView
        frameSx={{ flex: 1 }}
        sx={{ flexGrow: 1, paddingBottom: SCROLL_BOTTOM_PADDING }}
      >
        <Box sx={{ gap: ISLAND_GAP_STEP }}>{inner}</Box>
      </ScrollView>
    );
  }
  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}>{inner}</Box>
  );
}

function WideScreenShell({
  screenId,
  breadcrumbs,
  actions,
  content,
  scroll,
  keyboardAvoiding,
  leading,
  footer,
  primaryActionProps,
  surface,
  dataSet,
}: {
  screenId: string;
  breadcrumbs: ScreenBaseProps['breadcrumbs'];
  actions: ScreenBaseAction[];
  content: ScreenBaseProps['content'];
  scroll: boolean;
  keyboardAvoiding: boolean;
  leading: ReactNode | undefined;
  footer: ReactNode | undefined;
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  surface: ScreenBaseSurface;
  dataSet: ScreenBaseProps['dataSet'];
}): ReactNode {
  const body =
    surface === 'canvas' ? (
      <WideCanvasBody scroll={scroll} content={content} footer={footer} />
    ) : (
      <WideIslandBody scroll={scroll} content={content} footer={footer} />
    );
  const shell = (
    <Box
      sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}
      testID={`screen-${screenId}`}
      {...componentDataSet('ScreenBase', { ...dataSet, screen: screenId })}
    >
      <WidePageHeader
        breadcrumbs={breadcrumbs}
        actions={actions}
        leading={leading}
        primaryActionProps={primaryActionProps}
      />
      {body}
    </Box>
  );
  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView sx={{ flex: 1 }}>{shell}</KeyboardAvoidingView>
    );
  }
  return shell;
}

export function ScreenBaseWide({
  screenId,
  breadcrumbs,
  actions,
  content,
  scroll = false,
  largeTitle = false,
  keyboardAvoiding = false,
  leading,
  footer,
  primaryAction,
  surface = 'island',
  dataSet,
}: ScreenBaseProps): ReactNode {
  const shell = (
    primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined
  ) => (
    <WideScreenShell
      screenId={screenId}
      breadcrumbs={breadcrumbs}
      actions={actions ?? []}
      content={content}
      scroll={scroll}
      keyboardAvoiding={keyboardAvoiding}
      leading={leading}
      footer={footer}
      primaryActionProps={primaryActionProps}
      surface={surface ?? 'island'}
      dataSet={dataSet}
    />
  );

  const withPrimary =
    primaryAction !== undefined ? (
      <ScreenBasePrimaryActionMutation config={primaryAction}>
        {(props) => shell(props)}
      </ScreenBasePrimaryActionMutation>
    ) : (
      shell(undefined)
    );

  if (!largeTitle) {
    return withPrimary;
  }

  return (
    <ScreenTitleProvider title={lastBreadcrumbTitle(breadcrumbs)}>
      {withPrimary}
    </ScreenTitleProvider>
  );
}
