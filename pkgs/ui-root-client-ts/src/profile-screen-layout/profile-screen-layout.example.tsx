import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

export default function ProfileScreenLayoutExample(): JSX.Element {
  const [editing, setEditing] = createSignal(false);
  return (
    <ScreenExampleFrame>
      <ProfileScreenLayout
        screenId="example-profile"
        breadcrumbs={[{ name: 'Profile' }]}
        identity={
          <>
            <Avatar size={96} />
            <p class="text textHeading">Alex</p>
            <p class="text textCaption">@alex</p>
          </>
        }
        identityActions={
          <Button
            title={editing() ? 'Done' : 'Edit profile'}
            variant="outline"
            fullWidth
            onClick={() => setEditing(!editing())}
          />
        }
      >
        <MenuSection title="Activity">
          <MenuRow title="Rounds played" value="24" />
          <MenuRow title="Puzzles solved" value="18" />
        </MenuSection>
      </ProfileScreenLayout>
    </ScreenExampleFrame>
  );
}
