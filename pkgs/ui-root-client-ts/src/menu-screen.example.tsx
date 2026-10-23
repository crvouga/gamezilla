import { createSignal, type JSX } from 'solid-js';
import { MenuRow } from './menu-row';
import { MenuScreen } from './menu-screen';
import { MenuSection } from './menu-section';
import { ScreenExampleFrame } from './screen-example-frame';
import { Switch } from './switch';

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
