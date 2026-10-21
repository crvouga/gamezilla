import type { JSX } from 'solid-js';
import { EmbeddedScreen } from './embedded-screen';
import { MenuRow } from './menu-row';
import { MenuSection } from './menu-section';
import { ScreenExampleFrame } from './screen-example-frame';

export default function EmbeddedScreenExample(): JSX.Element {
  return (
    <ScreenExampleFrame>
      <EmbeddedScreen
        screenId="example-embedded"
        title="Round options"
        subtitle="The host owns the back button and top bar."
      >
        <MenuSection title="This round">
          <MenuRow title="Pace" value="Relaxed" />
          <MenuRow title="Spectators" value="Allowed" />
        </MenuSection>
      </EmbeddedScreen>
    </ScreenExampleFrame>
  );
}
