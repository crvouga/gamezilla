import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

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
