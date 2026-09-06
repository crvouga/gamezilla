import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  CheckIcon,
  type IconComponent,
  MenuRow,
  MenuSection,
  MonitorIcon,
  MoonIcon,
  ScreenBase,
  SunIcon,
  type ThemePreference,
  useTheme,
  useThemePreference,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

const ROW_ICON_SIZE = 20;
const CHECK_SIZE = 20;

type ThemeOption = {
  readonly key: ThemePreference;
  readonly title: string;
  readonly caption: string;
  readonly icon: IconComponent;
};

function useThemeOptions(): readonly ThemeOption[] {
  const { t } = useLingui();
  return [
    {
      key: 'light',
      title: t`Light`,
      caption: t`Bright surfaces, dark text`,
      icon: SunIcon,
    },
    {
      key: 'dark',
      title: t`Dark`,
      caption: t`Dim surfaces, light text`,
      icon: MoonIcon,
    },
    {
      key: 'system',
      title: t`System`,
      caption: t`Follows your device appearance`,
      icon: MonitorIcon,
    },
  ];
}

function ThemeOptionRow({
  option,
  selected,
  onSelect,
}: {
  readonly option: ThemeOption;
  readonly selected: boolean;
  readonly onSelect: (key: ThemePreference) => void;
}): ReactNode {
  const theme = useTheme();
  const Icon = option.icon;
  return (
    <MenuRow
      title={option.title}
      caption={option.caption}
      selected={selected}
      leading={
        <Icon
          size={ROW_ICON_SIZE}
          color={selected ? theme.colors.tint : theme.colors.icon}
        />
      }
      trailing={
        selected ? (
          <CheckIcon size={CHECK_SIZE} color={theme.colors.tint} />
        ) : (
          <Box sx={{ width: CHECK_SIZE }} />
        )
      }
      onPress={() => onSelect(option.key)}
    />
  );
}

export function ThemeSettingsScreen() {
  const { preference, setPreference } = useThemePreference();
  const nav = useBreadcrumbNav();
  const options = useThemeOptions();

  return (
    <ScreenBase
      screenId="theme"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Appearance</Trans> },
      ]}
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection title={<Trans>Theme</Trans>}>
            {options.map((option) => (
              <ThemeOptionRow
                key={option.key}
                option={option}
                selected={preference === option.key}
                onSelect={setPreference}
              />
            ))}
          </MenuSection>
        </Box>
      )}
    />
  );
}
