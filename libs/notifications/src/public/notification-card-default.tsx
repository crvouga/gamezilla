import { useLingui } from '@lingui/react/macro';
import { isSoundId } from '@pkgs/sounds';
import {
  Avatar,
  Box,
  Button,
  ChevronRightIcon,
  CircleCheckIcon,
  Pressable,
  SCREEN_BODY_PADDING_STEP,
  Text,
  Trash2Icon,
  UserIcon,
  useMutationButton,
  useRelativeTimeLabel,
  useTheme,
} from '@pkgs/ui-rn';
import { type ReactNode, useCallback } from 'react';

import type { Notification } from '../shared/notifications/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '../shared/notifications/notification-action';

/** Matches ScreenBase body inset once the list bleeds to the screen edge. */
const ROW_EDGE_PADDING = SCREEN_BODY_PADDING_STEP;
const ROW_VERTICAL_PADDING = 4;
const LEADING_SIZE = 48;

type NotificationActionButtonProps = {
  readonly interaction: Notification;
  readonly action: NotificationAction;
  readonly actions: NotificationCardActions;
  readonly testID?: string;
};

function actionStartIcon(action: NotificationAction): ReactNode {
  if (action.id === 'accept' || action.id === 'confirm') {
    return <CircleCheckIcon />;
  }
  if (
    action.id === 'decline' ||
    action.id === 'delete' ||
    action.id === 'dismiss' ||
    action.destructive === true
  ) {
    return <Trash2Icon />;
  }
  return undefined;
}

function NotificationActionButton({
  interaction,
  action,
  actions,
  testID,
}: NotificationActionButtonProps): ReactNode {
  const { t } = useLingui();
  const successSound =
    action.soundKey !== undefined && isSoundId(action.soundKey)
      ? action.soundKey
      : undefined;
  const mutation = useMutationButton({
    operation: useCallback(async () => {
      await actions.performAction(interaction.id, action.id);
    }, [actions, interaction.id, action.id]),
    labels: {
      idle: action.label,
      loading: t`Working…`,
      success: t`Done`,
      error: t`Failed`,
    },
    successHoldMs: 0,
    ...(successSound !== undefined
      ? { sounds: { success: successSound, error: 'feedback.error' as const } }
      : { sounds: { error: 'feedback.error' as const } }),
  });
  const startIcon = actionStartIcon(action);

  return (
    <Button
      {...mutation.buttonProps}
      variant="ghost"
      size="sm"
      intent={action.destructive === true ? 'danger' : 'primary'}
      {...(startIcon !== undefined ? { startIcon } : {})}
      disabled={
        action.disabled === true || mutation.buttonProps.disabled === true
      }
      {...(testID !== undefined ? { testID } : {})}
    />
  );
}

function avatarInitials(fallbackLabel: string): string {
  const trimmed = fallbackLabel.trim().replace(/^@/, '');
  if (trimmed.length === 0) return '?';
  return trimmed.slice(0, 2).toUpperCase();
}

function DefaultLeading({
  interaction,
}: {
  readonly interaction: Notification;
}): ReactNode {
  const label = interaction.avatar?.fallbackLabel;
  if (label === undefined) {
    return (
      <Avatar size={LEADING_SIZE} icon={UserIcon} background="surfaceMuted" />
    );
  }
  return <Avatar size={LEADING_SIZE} initials={avatarInitials(label)} />;
}

function InteractionRowText({
  interaction,
}: {
  readonly interaction: Notification;
}): ReactNode {
  const relative = useRelativeTimeLabel(interaction.createdAt);
  const detailParts = [interaction.subtitle, interaction.body].filter(
    (part): part is string => part !== undefined && part.length > 0
  );
  return (
    <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
      <Text
        variant={interaction.isUnread ? 'bodyBold' : 'body'}
        numberOfLines={3}
        label={interaction.title}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={relative}
      />
      {detailParts.length > 0 ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={detailParts.join(' · ')}
          numberOfLines={2}
        />
      ) : null}
    </Box>
  );
}

function InteractionRowTrailing({
  interaction,
  actions,
  showInlineActions,
  showChevron,
  actionTestID,
}: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly showInlineActions: boolean;
  readonly showChevron: boolean;
  readonly actionTestID?: (action: NotificationAction) => string | undefined;
}): ReactNode {
  const theme = useTheme();
  if (showInlineActions && interaction.actions.length > 0) {
    return (
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
        {interaction.actions.map((action) => {
          const testID = actionTestID?.(action);
          return (
            <NotificationActionButton
              key={action.id}
              interaction={interaction}
              action={action}
              actions={actions}
              {...(testID !== undefined ? { testID } : {})}
            />
          );
        })}
      </Box>
    );
  }
  if (showChevron) {
    return <ChevronRightIcon size={18} color={theme.colors.icon} />;
  }
  return null;
}

export type NotificationCardDefaultProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  /** Opens the deep-link / profile when the row (or text area) is pressed. */
  readonly onOpen?: () => void;
  /**
   * Whole-row press (summary mode). Takes precedence over {@link onOpen}.
   * Prefer this when inline actions are hidden and the row has a custom handler.
   */
  readonly onPress?: () => void;
  /**
   * When false, hides published action buttons.
   * Defaults to true.
   */
  readonly showInlineActions?: boolean;
  readonly leading?: ReactNode;
  readonly actionTestID?: (action: NotificationAction) => string | undefined;
  readonly testID?: string;
};

export function NotificationCardDefault({
  interaction,
  actions,
  onOpen,
  onPress,
  showInlineActions = true,
  leading,
  actionTestID,
  testID,
}: NotificationCardDefaultProps): ReactNode {
  const hasInlineActions = showInlineActions && interaction.actions.length > 0;
  // Whole row like MenuRow when no inline buttons compete for presses.
  // With inline actions, only the text area opens so Accept/Decline stay tappable.
  const rowPress = onPress ?? (hasInlineActions ? undefined : onOpen);
  const textPress =
    rowPress === undefined && onOpen !== undefined ? onOpen : undefined;
  const main = (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        px: ROW_EDGE_PADDING,
        py: ROW_VERTICAL_PADDING,
      }}
    >
      {leading ?? <DefaultLeading interaction={interaction} />}
      {textPress !== undefined ? (
        <Pressable onPress={textPress} sx={{ flex: 1, minWidth: 0 }}>
          <InteractionRowText interaction={interaction} />
        </Pressable>
      ) : (
        <InteractionRowText interaction={interaction} />
      )}
      <InteractionRowTrailing
        interaction={interaction}
        actions={actions}
        showInlineActions={showInlineActions}
        showChevron={rowPress !== undefined}
        {...(actionTestID !== undefined ? { actionTestID } : {})}
      />
    </Box>
  );

  if (rowPress !== undefined) {
    return (
      <Pressable
        onPress={rowPress}
        accessibilityRole="button"
        {...(testID !== undefined ? { testID } : {})}
      >
        {main}
      </Pressable>
    );
  }
  if (testID !== undefined) {
    return <Box testID={testID}>{main}</Box>;
  }
  return main;
}
