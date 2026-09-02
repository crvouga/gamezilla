import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSoundsPreference } from '@pkgs/sounds';
import { Box, ScreenBase, Switch, Text } from '@pkgs/ui';

export function SoundSettingsScreen() {
  const { t } = useLingui();
  const { muted, setMuted } = useSoundsPreference();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="sound"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Sound</Trans> },
      ]}
      content={({ sx }) => (
        <Box sx={[sx, { gap: 3 }]}>
          <Text
            variant="body"
            label={
              <Trans>
                Control in-app sound effects. This does not change your device
                volume.
              </Trans>
            }
          />
          <Switch
            label={t`Sound effects`}
            value={!muted}
            onValueChange={(on) => setMuted(!on)}
          />
        </Box>
      )}
    />
  );
}
