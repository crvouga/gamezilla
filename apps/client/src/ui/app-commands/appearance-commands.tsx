import { RegisterCommand, useThemePreference } from '@gamezilla/lib/ui';

export function AppearanceCommands() {
  const { setPreference } = useThemePreference();
  return (
    <>
      <RegisterCommand
        id="theme-light"
        title="Use light theme"
        category="Appearance"
        icon="paintbrush.fill"
        keywords={['light', 'day', 'bright']}
        run={async () => {
          setPreference('light');
        }}
      />
      <RegisterCommand
        id="theme-dark"
        title="Use dark theme"
        category="Appearance"
        icon="paintbrush.fill"
        keywords={['dark', 'night']}
        run={async () => {
          setPreference('dark');
        }}
      />
      <RegisterCommand
        id="theme-system"
        title="Use system theme"
        category="Appearance"
        icon="paintbrush.fill"
        keywords={['system', 'auto', 'os']}
        run={async () => {
          setPreference('system');
        }}
      />
    </>
  );
}
