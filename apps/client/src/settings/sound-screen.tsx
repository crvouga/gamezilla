import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSoundsPreference } from '@pkgs/sounds';
import {
  Box,
  MenuRow,
  MenuSection,
  ScreenBase,
  Switch,
  useTheme,
  Volume2Icon,
  VolumeXIcon,
} from '@pkgs/ui-rn';

const ROW_ICON_SIZE = 20;

export function SoundSettingsScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const { muted, setMuted } = useSoundsPreference();
  const nav = useBreadcrumbNav();
  const Icon = muted ? VolumeXIcon : Volume2Icon;

  return (
    <ScreenBase
      screenId="sound"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Sound</Trans> },
      ]}
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection
            footer={
              <Trans>
                Controls in-app sound effects only. Your device volume is not
                affected.
              </Trans>
            }
          >
            <MenuRow
              title={t`Sound effects`}
              caption={muted ? t`Muted` : t`On`}
              leading={<Icon size={ROW_ICON_SIZE} color={theme.colors.icon} />}
              trailing={
                <Switch
                  value={!muted}
                  onValueChange={(on) => setMuted(!on)}
                  accessibilityLabel={t`Sound effects`}
                />
              }
            />
          </MenuSection>
        </Box>
      )}
    />
  );
}
