import { ConnectivityStatusBarItem } from './connectivity-status-bar-item';
import { NotificationsStatusBarItem } from './notifications-status-bar-item';
import { PingStatusBarItem } from './ping-status-bar-item';
import { SoundStatusBarItem } from './sound-status-bar-item';
import { ThemeStatusBarItem } from './theme-status-bar-item';
import { UserStatusBarItem } from './user-status-bar-item';

/**
 * App-wide status-bar registrations (connectivity, ping, user, theme, sound,
 * notifications). Features invert dependency by registering here rather than
 * the bar importing them.
 */
export function AppStatusBarItems() {
  return (
    <>
      <ConnectivityStatusBarItem />
      <PingStatusBarItem />
      <UserStatusBarItem />
      <ThemeStatusBarItem />
      <SoundStatusBarItem />
      <NotificationsStatusBarItem />
    </>
  );
}
