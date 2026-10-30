import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

export default function ContentScreenExample(): JSX.Element {
  return (
    <ScreenExampleFrame>
      <ContentScreen
        screenId="example-content"
        breadcrumbs={[{ name: 'Device details' }]}
      >
        <Notice>This device is connected.</Notice>
        <MenuSection title="Device">
          <MenuRow title="Name" value="Personal phone" />
          <MenuRow title="Last active" value="Today" />
        </MenuSection>
        <p class="text textBody">
          Details, notices, and documents share this readable column. Longer
          content scrolls without moving the screen header.
        </p>
      </ContentScreen>
    </ScreenExampleFrame>
  );
}
