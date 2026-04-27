import { AccountCommand } from './account-command';
import { AppearanceCommands } from './appearance-commands';
import { NavigationCommands } from './navigation-commands';
import { UiComponentsCommands } from './ui-components-commands';
import { WipeLocalDatabaseCommand } from './wipe-local-database-command';

/**
 * App-wide commands for the command palette (routes, theme, auth).
 */
export function AppCommands() {
  return (
    <>
      <NavigationCommands />
      <UiComponentsCommands />
      <AppearanceCommands />
      <WipeLocalDatabaseCommand />
      <AccountCommand />
    </>
  );
}
