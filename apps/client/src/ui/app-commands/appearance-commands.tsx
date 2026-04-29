import { RegisterCommand, useThemePreference } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export function AppearanceCommands() {
  const { t } = useLingui();
  const { setPreference } = useThemePreference();
  return (
    <>
      <RegisterCommand
        id="theme-light"
        title={t`Use light theme`}
        category={t`Appearance`}
        icon="paintbrush.fill"
        keywords={[t`light`, t`day`, t`bright`]}
        run={async () => {
          setPreference('light');
        }}
      />
      <RegisterCommand
        id="theme-dark"
        title={t`Use dark theme`}
        category={t`Appearance`}
        icon="paintbrush.fill"
        keywords={[t`dark`, t`night`]}
        run={async () => {
          setPreference('dark');
        }}
      />
      <RegisterCommand
        id="theme-system"
        title={t`Use system theme`}
        category={t`Appearance`}
        icon="paintbrush.fill"
        keywords={[t`system`, t`auto`, t`os`]}
        run={async () => {
          setPreference('system');
        }}
      />
    </>
  );
}
