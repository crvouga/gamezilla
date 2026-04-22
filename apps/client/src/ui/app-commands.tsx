import { useAuth } from '@gamezilla/client/features/auth/auth-context';
import { clearLocalDatabaseAndReload } from '@gamezilla/patch-db/bootstrap-expo';
import {
  ConfirmationModal,
  RegisterCommand,
  useThemePreference,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';

/**
 * App-wide commands for the command palette (routes, theme, auth).
 */
export function AppCommands() {
  const router = useRouter();
  const auth = useAuth();
  const { setPreference } = useThemePreference();
  const [wipeLocalDbModalVisible, setWipeLocalDbModalVisible] = useState(false);

  return (
    <>
      <RegisterCommand
        id="nav-home"
        title="Go to Spaces"
        category="Navigation"
        icon="house.fill"
        keywords={['home', 'spaces']}
        shortcut="mod+1"
        run={async () => {
          router.push('/');
        }}
      />
      <RegisterCommand
        id="nav-profile"
        title="Go to Profile"
        category="Navigation"
        icon="person.fill"
        keywords={['account', 'user']}
        shortcut="mod+2"
        run={async () => {
          router.push('/profile');
        }}
      />
      <RegisterCommand
        id="nav-settings"
        title="Go to Settings"
        category="Navigation"
        icon="gearshape.fill"
        keywords={['preferences', 'more']}
        run={async () => {
          router.push('/more');
        }}
      />
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
      <RegisterCommand
        id="data-wipe-local-database"
        title="Wipe local database"
        subtitle="Clear SQLite and reload (same as Clear data in Todos)"
        category="Data"
        icon="database.fill"
        keywords={[
          'wipe',
          'clear',
          'reset',
          'sqlite',
          'database',
          'reload',
          'local',
        ]}
        run={async () => {
          setWipeLocalDbModalVisible(true);
        }}
      />
      <RegisterCommand
        id="auth-toggle"
        title={auth.mode === 'signed-in' ? 'Sign out' : 'Sign in with Google'}
        category="Account"
        icon={
          auth.mode === 'signed-in'
            ? 'arrow.right.from.bracket'
            : 'right.to.bracket'
        }
        run={async () => {
          if (auth.mode === 'signed-in') {
            await auth.signOut();
          } else {
            await auth.signInWithGoogle();
          }
        }}
      />

      <ConfirmationModal
        visible={wipeLocalDbModalVisible}
        title="Wipe local database?"
        message="This deletes all local SQLite data and reloads the app. You cannot undo this."
        variant="destructive"
        confirmLabel="Wipe and reload"
        onConfirm={async () => {
          setWipeLocalDbModalVisible(false);
          await clearLocalDatabaseAndReload('main');
        }}
        onCancel={() => setWipeLocalDbModalVisible(false)}
      />
    </>
  );
}
