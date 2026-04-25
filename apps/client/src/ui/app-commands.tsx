import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  ConfirmationModal,
  RegisterCommand,
  useThemePreference,
} from '@gamezilla/lib/ui';
import { clearLocalDatabaseAndReload } from '@gamezilla/patch-db/bootstrap-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';

function NavigationCommands() {
  const router = useRouter();
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
    </>
  );
}

function AppearanceCommands() {
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

function AccountCommand() {
  const auth = useAuth();
  return (
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
  );
}

function WipeLocalDatabaseCommand() {
  const [visible, setVisible] = useState(false);
  return (
    <>
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
          setVisible(true);
        }}
      />
      <ConfirmationModal
        visible={visible}
        title="Wipe local database?"
        message="This deletes all local SQLite data and reloads the app. You cannot undo this."
        variant="destructive"
        confirmLabel="Wipe and reload"
        onConfirm={async () => {
          setVisible(false);
          await clearLocalDatabaseAndReload('main');
        }}
        onCancel={() => setVisible(false)}
      />
    </>
  );
}

/**
 * App-wide commands for the command palette (routes, theme, auth).
 */
export function AppCommands() {
  return (
    <>
      <NavigationCommands />
      <AppearanceCommands />
      <WipeLocalDatabaseCommand />
      <AccountCommand />
    </>
  );
}
