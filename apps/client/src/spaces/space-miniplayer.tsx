import type { SpaceMiniplayerModel } from '@gamezilla/client/spaces/space-miniplayer-model-types';
import {
  MiniplayerHostRow,
  MiniplayerMemberStack,
} from '@gamezilla/client/spaces/space-miniplayer-parts';
import { useSpaceMiniplayerModel } from '@gamezilla/client/spaces/use-space-miniplayer-model';
import {
  Box,
  ConfirmationModal,
  Pressable,
  StatusDot,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function EndSpaceModal({
  visible,
  onClose,
  onEnd,
}: {
  visible: boolean;
  onClose: () => void;
  onEnd: () => void;
}) {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>End space?</Trans>}
      message={
        <Trans>Everyone will leave this space. This cannot be undone.</Trans>
      }
      confirmLabel={<Trans>End space</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="destructive"
      onConfirm={onEnd}
      onCancel={onClose}
    />
  );
}

function LeaveSpaceModal({
  visible,
  onClose,
  onLeave,
}: {
  visible: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>Leave space?</Trans>}
      message={
        <Trans>You can join again later if the space is still live.</Trans>
      }
      confirmLabel={<Trans>Leave</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="default"
      onConfirm={onLeave}
      onCancel={onClose}
    />
  );
}

function MiniplayerDock({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 8,
      }}
    >
      {children}
    </Box>
  );
}

type VisibleModel = Extract<SpaceMiniplayerModel, { visible: true }>;

function MiniplayerOpenArea({ model }: { model: VisibleModel }) {
  const { t } = useLingui();
  const theme = useTheme();
  const surfaceColor = theme.colors.surface;
  const count = model.memberCount;
  const countLabel = t`${count} people here`;

  return (
    <Pressable
      onPress={model.onOpenSpace}
      accessibilityRole="button"
      accessibilityLabel={t`Tap to return to your space`}
      sx={{ flex: 1, minWidth: 0, paddingVertical: 2, paddingHorizontal: 2 }}
    >
      <Box sx={{ gap: 1 }}>
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
          <StatusDot status="online" size={8} />
          <Text
            variant="bodyBold"
            numberOfLines={1}
            sx={{ flex: 1, minWidth: 0 }}
            label={model.spaceTitle}
          />
        </Box>
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          {model.hostId ? (
            <MiniplayerHostRow
              hostId={model.hostId}
              hostLabel={model.hostLabel}
              hostAvatarConfig={model.hostAvatarConfig}
            />
          ) : null}
          <MiniplayerMemberStack
            membersForStack={model.membersForStack}
            surfaceColor={surfaceColor}
          />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={countLabel}
          />
        </Box>
      </Box>
    </Pressable>
  );
}

function MiniplayerEndLeave({ model }: { model: VisibleModel }) {
  const { t } = useLingui();
  return (
    <Pressable
      onPress={model.isHost ? model.onRequestEnd : model.onRequestLeave}
      accessibilityRole="button"
      accessibilityLabel={model.isHost ? t`End space` : t`Leave space`}
      sx={{
        paddingVertical: 2,
        paddingHorizontal: 3,
        borderRadius: 8,
        background: model.isHost ? 'tint' : 'transparent',
        borderWidth: model.isHost ? 0 : 1,
        borderColor: 'border',
      }}
    >
      <Text
        variant="caption"
        sx={{ color: model.isHost ? '#fff' : 'text' }}
        label={model.isHost ? <Trans>End</Trans> : <Trans>Leave</Trans>}
      />
    </Pressable>
  );
}

function SpaceMiniplayerView(props: VisibleModel) {
  return (
    <>
      <MiniplayerDock>
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 2,
            paddingHorizontal: 2,
            gap: 2,
            minHeight: 56,
          }}
        >
          <MiniplayerOpenArea model={props} />
          <MiniplayerEndLeave model={props} />
        </Box>
      </MiniplayerDock>
      <EndSpaceModal
        visible={props.confirmEnd}
        onClose={props.onCloseEnd}
        onEnd={props.onConfirmEnd}
      />
      <LeaveSpaceModal
        visible={props.confirmLeave}
        onClose={props.onCloseLeave}
        onLeave={props.onConfirmLeave}
      />
    </>
  );
}

export function SpaceMiniplayer() {
  const model = useSpaceMiniplayerModel();
  if (!model.visible) {
    return null;
  }
  return <SpaceMiniplayerView {...model} />;
}
