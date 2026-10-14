import { createSignal, type JSX } from 'solid-js';
import { Avatar } from './avatar';
import { Button } from './button';
import { MenuRow } from './menu-row';
import { MenuSection } from './menu-section';
import { ProfileScreenLayout } from './profile-screen-layout';
import { ScreenExampleFrame } from './screen-example-frame';

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
