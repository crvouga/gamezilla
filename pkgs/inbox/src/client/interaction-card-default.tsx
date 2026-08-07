import { useLingui } from '@lingui/react/macro';
import { isSoundId } from '@pkgs/sounds';
import { Box, Button, Pressable, Text, useMutationButton } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import type { Interaction } from '../shared/interaction';
import type {
  InteractionAction,
  InteractionCardActions,
} from '../shared/interaction-action';

type InteractionActionButtonProps = {
  readonly interaction: Interaction;
  readonly action: InteractionAction;
  readonly actions: InteractionCardActions;
};

function InteractionActionButton({
  interaction,
  action,
  actions,
}: InteractionActionButtonProps): ReactNode {
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

  return (
    <Button
      variant={action.variant}
      {...mutation.buttonProps}
      disabled={
        action.disabled === true || mutation.buttonProps.disabled === true
      }
    />
  );
}

export type InteractionCardDefaultProps = {
  readonly interaction: Interaction;
  readonly actions: InteractionCardActions;
  readonly onOpen?: () => void;
};

export function InteractionCardDefault({
  interaction,
  actions,
  onOpen,
}: InteractionCardDefaultProps): ReactNode {
  return (
    <Pressable onPress={onOpen}>
      <Box
        sx={{
          gap: 1,
          p: 2,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: 'border',
          backgroundColor: interaction.isUnread ? 'surfaceRaised' : 'surface',
        }}
      >
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          {interaction.isUnread ? (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: 'brand',
              }}
            />
          ) : null}
          <Text variant="title" label={interaction.title} sx={{ flex: 1 }} />
        </Box>
        {interaction.subtitle !== undefined ? (
          <Text
            variant="body"
            label={interaction.subtitle}
            sx={{ color: 'textSecondary' }}
          />
        ) : null}
        {interaction.body !== undefined ? (
          <Text variant="caption" label={interaction.body} />
        ) : null}
        {interaction.actions.length > 0 ? (
          <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, pt: 1 }}>
            {interaction.actions.map((action) => (
              <InteractionActionButton
                key={action.id}
                interaction={interaction}
                action={action}
                actions={actions}
              />
            ))}
          </Box>
        ) : null}
      </Box>
    </Pressable>
  );
}
