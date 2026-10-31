import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { AppFrame } from '../app-frame/index';
import { AppFrameChromeProvider } from '../app-frame-chrome/index';
import { AppLogo } from '../app-logo/index';
import { Button } from '../button/index';
import { UserIcon } from '../icons';
import { ScreenBase } from '../screen-base/index';
import { AppHeaderIsland } from './index';

/** Route-free fixture: only presentation and explicit navigation callbacks. */
export default function SubscreenExample(): JSX.Element {
  const [editing, setEditing] = createSignal(true);
  return (
    <ExampleRoot>
      <AppFrameChromeProvider screenNavigation>
        <AppFrame
          header={
            <AppHeaderIsland
              leading={<AppLogo name="acme" size={24} />}
              items={[
                {
                  id: 'profile',
                  label: 'Profile tab',
                  icon: UserIcon,
                  active: true,
                  onClick: () => setEditing(false),
                },
              ]}
            />
          }
        >
          <Show
            when={editing()}
            fallback={
              <ScreenBase
                screenId="profile"
                breadcrumbs={[{ name: 'Profile' }]}
                content={() => (
                  <Button
                    title="Edit username"
                    onClick={() => setEditing(true)}
                  />
                )}
              />
            }
          >
            <ScreenBase
              screenId="profile-handle"
              measure="menu"
              breadcrumbs={[
                { name: 'Profile', onClick: () => setEditing(false) },
                { name: 'Edit profile', onClick: () => setEditing(false) },
                { name: 'Username' },
              ]}
              content={() => (
                <p class="text textBody">
                  Choose the name your friends will see.
                </p>
              )}
            />
          </Show>
        </AppFrame>
      </AppFrameChromeProvider>
    </ExampleRoot>
  );
}
