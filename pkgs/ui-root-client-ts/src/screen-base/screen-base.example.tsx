/** @jsxImportSource solid-js */

import { BackIconButton } from '@pkgs/ui-root-client-ts/back-icon-button';
import { FormActionsFooter } from '@pkgs/ui-root-client-ts/form-actions-footer';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { BellIcon, SearchIcon, ShareIcon } from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import { TopBar } from '@pkgs/ui-root-client-ts/top-bar';
import { TopBarTitle } from '@pkgs/ui-root-client-ts/top-bar-title';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const noop = (): void => undefined;

const PARAGRAPHS = [
  'Scroll this body: the hairline under the top bar appears once the content leaves the top, and goes away when you scroll back.',
  'The title sits left, after the 44px back control, in the heading style. Actions sit at the trailing edge and fold into a More menu before the title truncates.',
  'On phones the primary action is pinned in the footer as a full-width pill, with Cancel under it.',
  'Wide layouts trade the top bar for a page header with the breadcrumb trail.',
  'Body copy keeps the 16px page edge and 12px between sections.',
  'Nothing here moves unless you scroll or tap.',
];

function SectionLabel(props: { label: string }): JSX.Element {
  return <p class="text textSectionLabel">{props.label}</p>;
}

function Back(): JSX.Element {
  return (
    <div class="box -ml-2">
      <BackIconButton size={44} onClick={noop} />
    </div>
  );
}

function Actions(): JSX.Element {
  return (
    <div class="box flex-row items-center gap-2">
      <IconButton label="Share" onClick={noop}>
        <ShareIcon />
      </IconButton>
      <IconButton label="Search" onClick={noop}>
        <SearchIcon />
      </IconButton>
    </div>
  );
}

/** Every top bar shape a screen can have, drawn in place. */
function TopBarVariants(): JSX.Element {
  return (
    <SchemePreview>
      <SectionLabel label="Root screen: title and an action, at rest" />
      <TopBar
        safeAreaTop={false}
        divider={false}
        center={<TopBarTitle label="Spaces" />}
        trailing={
          <IconButton label="Notifications" onClick={noop}>
            <BellIcon />
          </IconButton>
        }
      />
      <SectionLabel label="Pushed screen: back and title, scrolled" />
      <TopBar
        safeAreaTop={false}
        leading={<Back />}
        center={<TopBarTitle label="Account privacy" />}
      />
      <SectionLabel label="Back, long title and actions" />
      <TopBar
        safeAreaTop={false}
        centerPosition="flex"
        leading={<Back />}
        center={
          <TopBarTitle label="Thursday night blitz league with the office" />
        }
        trailing={<Actions />}
      />
    </SchemePreview>
  );
}

export default function ScreenBaseExample(): JSX.Element {
  return (
    <ExampleRoot>
      <TopBarVariants />
      <SectionLabel label="ScreenBase: scroll the body, primary action pinned" />
      <ExampleRoot bounded>
        <ScreenBase
          screenId="screen-base-example"
          breadcrumbs={[
            { name: 'Design system', onClick: noop },
            { name: 'Profile details' },
          ]}
          actions={[{ type: 'secondary', label: 'Share', onClick: noop }]}
          scroll
          footer={
            <FormActionsFooter
              cancel={{ label: 'Cancel', onClick: noop }}
              submit={{
                label: 'Save changes',
                loadingLabel: 'Saving…',
                successLabel: 'Saved',
                operation: () => Promise.resolve(),
              }}
            />
          }
          content={() => (
            <For each={[...PARAGRAPHS, ...PARAGRAPHS]}>
              {(paragraph) => (
                <p class="text textBody text-text-secondary">{paragraph}</p>
              )}
            </For>
          )}
        />
      </ExampleRoot>
    </ExampleRoot>
  );
}
