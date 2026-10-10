/** @jsxImportSource solid-js */

import { useModeration } from '@libs/moderation-client/moderation-context';
import type { Notification } from '@libs/notifications-shared/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared/notification-action';
import { useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client/solid';
import type { SoundId } from '@pkgs/sounds-shared/sound-id';
import { isSoundId, Sounds } from '@pkgs/sounds-shared/sound-id';
import { Avatar } from '@pkgs/ui-root-client/avatar';
import { Button } from '@pkgs/ui-root-client/button';
import {
  ChevronRightIcon,
  CircleCheckIcon,
  Trash2Icon,
  UserIcon,
} from '@pkgs/ui-root-client/icons';
import type { MutationStateTransition } from '@pkgs/ui-root-client/mutation-lifecycle';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client/relative-time';
import { useTheme } from '@pkgs/ui-root-client/theme-context';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { createMemo, For, type JSX, Match, Show, Switch } from 'solid-js';

import { displayNotification } from './notification-display';

const ROW_VERTICAL_PADDING = 4;
const LEADING_SIZE = 48;

type NotificationActionButtonProps = {
  readonly interaction: Notification;
  readonly action: NotificationAction;
  readonly actions: NotificationCardActions;
  readonly testID?: string | undefined;
};

function actionStartIcon(action: NotificationAction): JSX.Element | undefined {
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

type MutationSoundIds = {
  readonly success?: SoundId | undefined;
  readonly error?: SoundId | undefined;
};

function useMutationPhaseSounds(
  sounds: () => MutationSoundIds
): (transition: MutationStateTransition) => void {
  const engine = useOptionalSoundEngine();
  return (transition) => {
    const current = engine?.();
    if (current === undefined) return;
    if (transition.to === 'success') {
      current.play(sounds().success ?? Sounds.feedback.success);
    } else if (transition.to === 'error') {
      current.play(sounds().error ?? Sounds.feedback.error);
    }
  };
}

function NotificationActionButton(
  props: NotificationActionButtonProps
): JSX.Element {
  const { t } = useLingui();
  const successSound = (): SoundId | undefined => {
    const soundKey = props.action.soundKey;
    return soundKey !== undefined && isSoundId(soundKey) ? soundKey : undefined;
  };
  const onPhaseChange = useMutationPhaseSounds(() => ({
    ...(successSound() !== undefined ? { success: successSound() } : {}),
    error: Sounds.feedback.error,
  }));
  const mutation = useMutationButton({
    operation: () =>
      props.actions.performAction(props.interaction.id, props.action.id),
    labels: {
      get idle() {
        return props.action.label;
      },
      get loading() {
        return t`Working…`;
      },
      get success() {
        return t`Done`;
      },
      get error() {
        return t`Failed`;
      },
    },
    successHoldMs: 0,
    get disabled() {
      return props.action.disabled === true;
    },
    onPhaseChange,
  });
  const startIcon = createMemo(() => actionStartIcon(props.action));

  return (
    <Button
      {...mutation.buttonProps}
      variant="ghost"
      size="sm"
      intent={props.action.destructive === true ? 'danger' : 'primary'}
      startIcon={startIcon()}
      dataSet={
        props.testID !== undefined ? { testid: props.testID } : undefined
      }
    />
  );
}

function avatarInitials(fallbackLabel: string): string {
  const trimmed = fallbackLabel.trim().replace(/^@/, '');
  if (trimmed.length === 0) return '?';
  return trimmed.slice(0, 2).toUpperCase();
}

function DefaultLeading(props: {
  readonly interaction: Notification;
}): JSX.Element {
  return (
    <Show
      when={props.interaction.avatar?.fallbackLabel}
      keyed
      fallback={
        <Avatar size={LEADING_SIZE} icon={UserIcon} background="surfaceMuted" />
      }
    >
      {(label) => (
        <Avatar size={LEADING_SIZE} initials={avatarInitials(label)} />
      )}
    </Show>
  );
}

function InteractionRowText(props: {
  readonly interaction: Notification;
}): JSX.Element {
  const relative = useRelativeTimeLabel(() => props.interaction.createdAt);
  const detailParts = createMemo(() =>
    [props.interaction.subtitle, props.interaction.body].filter(
      (part): part is string => part !== undefined && part.length > 0
    )
  );
  return (
    <div class="box flex-1 min-w-0 gap-1">
      <p
        class="text textBody line-clamp-3"
        classList={{
          textBodyBold:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'bodyBold',
          textCaption:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'caption',
          textLabel:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'label',
          textTitle:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'title',
          textSubtitle:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'subtitle',
          textHeading:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'heading',
          textNavigationTitle:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') ===
            'navigationTitle',
          textLink:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') === 'link',
          textMono:
            String(props.interaction.isUnread ? 'bodyBold' : 'body') === 'mono',
        }}
      >
        {props.interaction.title}
      </p>
      <p class="text textCaption text-text-secondary">{relative()}</p>
      <Show when={detailParts().length > 0}>
        <p class="text textCaption line-clamp-2 text-text-secondary">
          {detailParts().join(' · ')}
        </p>
      </Show>
    </div>
  );
}

function InteractionRowTrailing(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly showInlineActions: boolean;
  readonly showChevron: boolean;
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
}): JSX.Element {
  const theme = useTheme();
  return (
    <Switch>
      <Match
        when={props.showInlineActions && props.interaction.actions.length > 0}
      >
        <div class="box flex-row items-center gap-0.5">
          <For each={props.interaction.actions}>
            {(action) => (
              <NotificationActionButton
                interaction={props.interaction}
                action={action}
                actions={props.actions}
                testID={props.actionTestID?.(action)}
              />
            )}
          </For>
        </div>
      </Match>
      <Match when={props.showChevron}>
        <ChevronRightIcon size={18} color={theme.colors.icon} />
      </Match>
    </Switch>
  );
}

export type NotificationCardDefaultProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  /** Opens the deep-link / profile when the row (or text area) is pressed. */
  readonly onOpen?: (() => void) | undefined;
  /**
   * Whole-row press (summary mode). Takes precedence over {@link onOpen}.
   * Prefer this when inline actions are hidden and the row has a custom handler.
   */
  readonly onPress?: (() => void) | undefined;
  /**
   * When false, hides published action buttons.
   * Defaults to true.
   */
  readonly showInlineActions?: boolean | undefined;
  readonly leading?: JSX.Element | undefined;
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
  readonly testID?: string | undefined;
};

export function NotificationCardDefault(
  props: NotificationCardDefaultProps
): JSX.Element {
  const moderation = useModeration();
  const hasInlineActions = createMemo(
    () =>
      (props.showInlineActions ?? true) && props.interaction.actions.length > 0
  );
  // Whole row like MenuRow when no inline buttons compete for presses.
  // With inline actions, only the text area opens so Accept/Decline stay tappable.
  const rowPress = createMemo<(() => void) | undefined>(() =>
    props.onPress !== undefined
      ? props.onPress
      : hasInlineActions()
        ? undefined
        : props.onOpen
  );
  // Copy as the reader may see it now (snapshot usernames moderated).
  const shown = createMemo(() =>
    displayNotification(moderation(), props.interaction)
  );
  const textPress = createMemo<(() => void) | undefined>(() =>
    rowPress() === undefined && props.onOpen !== undefined
      ? props.onOpen
      : undefined
  );

  const main = (): JSX.Element => (
    <div
      class="box flex-row items-center gap-3"
      style={{
        'padding-top': `${ROW_VERTICAL_PADDING * 4}px`,
        'padding-bottom': `${ROW_VERTICAL_PADDING * 4}px`,
      }}
    >
      {props.leading ?? <DefaultLeading interaction={shown()} />}
      <Show
        when={textPress()}
        keyed
        fallback={<InteractionRowText interaction={shown()} />}
      >
        {(press) => (
          <button
            class="clickable clickableTint flex-1 min-w-0"
            type="button"
            onClick={press}
          >
            <InteractionRowText interaction={shown()} />
          </button>
        )}
      </Show>
      <InteractionRowTrailing
        interaction={props.interaction}
        actions={props.actions}
        showInlineActions={props.showInlineActions ?? true}
        showChevron={rowPress() !== undefined}
        actionTestID={props.actionTestID}
      />
    </div>
  );

  return (
    <Switch>
      <Match when={rowPress() !== undefined}>
        <button
          class="clickable clickableTint"
          {...dataAttrs(
            props.testID !== undefined ? { testid: props.testID } : undefined
          )}
          type="button"
          onClick={() => rowPress()?.()}
        >
          {main()}
        </button>
      </Match>
      <Match when={props.testID} keyed>
        {(testID) => (
          <div class="box" data-testid={testID}>
            {main()}
          </div>
        )}
      </Match>
      <Match when={true}>{main()}</Match>
    </Switch>
  );
}
