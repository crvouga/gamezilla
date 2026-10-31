import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

export default function MenuScreenExample(): JSX.Element {
  const [sound, setSound] = createSignal(true);
  const [section, setSection] = createSignal('Preferences');
  return (
    <ScreenExampleFrame>
      <MenuScreen screenId="example-menu" breadcrumbs={[{ name: 'Settings' }]}>
        <MenuSection title="Preferences">
          <MenuRow
            title="Sound effects"
            trailing={
              <Switch
                value={sound()}
                onValueChange={setSound}
                aria-label="Sound effects"
              />
            }
          />
          <MenuRow
            title="Appearance"
            value="System"
            onClick={() => setSection('Appearance')}
          />
        </MenuSection>
        <MenuSection title="Account">
          <MenuRow
            title="Profile"
            caption="Picture and display name"
            onClick={() => setSection('Profile')}
          />
          <MenuRow title="Privacy" onClick={() => setSection('Privacy')} />
        </MenuSection>
        <p class="text textCaption" role="status">
          {section()}
        </p>
      </MenuScreen>
    </ScreenExampleFrame>
  );
}
