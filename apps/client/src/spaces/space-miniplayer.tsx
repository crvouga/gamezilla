import type { SpaceMiniplayerModel } from '@gamezilla/client/spaces/space-miniplayer-model-types';
import {
  MiniplayerHostHeader,
  MiniplayerLiveBadge,
} from '@gamezilla/client/spaces/space-miniplayer-parts';
import { useSpaceMiniplayerModel } from '@gamezilla/client/spaces/use-space-miniplayer-model';
import {
  Box,
  ConfirmationModal,
  GradientBox,
  Pressable,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTION_BG = 'rgba(255,255,255,0.22)';
const ACTION_BG_DESTRUCTIVE = 'rgba(0,0,0,0.28)';
const ACTION_TEXT = '#FFFFFF';

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
  const insets = useSafeAreaInsets();
  return (
    <Box
      style={{
        paddingTop: 8,
        paddingHorizontal: 12,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
      }}
    >
      {children}
    </Box>
  );
}

type VisibleModel = Extract<SpaceMiniplayerModel, { visible: true }>;

function MiniplayerActionButton({ model }: { model: VisibleModel }) {
  const { t } = useLingui();
  const isHost = model.isHost;
  return (
    <Pressable
      onPress={isHost ? model.onRequestEnd : model.onRequestLeave}
      accessibilityRole="button"
      accessibilityLabel={isHost ? t`End space` : t`Leave space`}
      sx={{
        paddingVertical: 2,
        paddingHorizontal: 4,
        borderRadius: 999,
        backgroundColor: isHost ? ACTION_BG_DESTRUCTIVE : ACTION_BG,
      }}
    >
      <Text
        variant="caption"
        sx={{ color: ACTION_TEXT, fontWeight: '600' }}
        label={isHost ? <Trans>End</Trans> : <Trans>Leave</Trans>}
      />
    </Pressable>
  );
}

function SpaceMiniplayerView(props: VisibleModel) {
  const { t } = useLingui();
  const theme = useTheme();
  const gradientColors = [
    theme.colors.gradientPrimaryStart,
    theme.colors.gradientPrimaryEnd,
  ] as const;
  const count = props.memberCount;
  const countLabel = t`${count} people here`;

  return (
    <>
      <MiniplayerDock>
        <Pressable
          onPress={props.onOpenSpace}
          accessibilityRole="button"
          accessibilityLabel={t`Tap to return to your space`}
        >
          <GradientBox
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            sx={{
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              p: 3,
              gap: 2,
              minHeight: 72,
            }}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <MiniplayerHostHeader
              spaceTitle={props.spaceTitle}
              hostId={props.hostId}
              hostLabel={props.hostLabel}
              hostAvatarConfig={props.hostAvatarConfig}
              countLabel={countLabel}
            />
            <MiniplayerLiveBadge />
            <MiniplayerActionButton model={props} />
          </GradientBox>
        </Pressable>
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
