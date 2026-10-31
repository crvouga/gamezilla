/** @jsxImportSource solid-js */

import { BackIconButton } from '@pkgs/ui-root-client-ts/back-icon-button';
import { CloseIconButton } from '@pkgs/ui-root-client-ts/close-icon-button';
import {
  IconButton,
  iconButtonAvatarContentSize,
} from '@pkgs/ui-root-client-ts/icon-button';
import {
  BellIcon,
  EllipsisIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const AVATAR_BUTTON_SIZE = 40;

function Row(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="box gap-2">
      <p class="text textFootnote">{props.label}</p>
      <div class="box flex-row flex-wrap gap-2 items-center">
        {props.children}
      </div>
    </div>
  );
}

export default function IconButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Hover for the tint and the tooltip; Tab for the 2px focus ring. Every icon button has a required label (its accessible name) and a 44px hit area, whatever the disc size.'
        }
      </p>
      <SchemePreview>
        <div class="box gap-4">
          <Row label="Header controls: 40px disc, 24px outline icon">
            <BackIconButton onClick={() => undefined} />
            <IconButton label="Notifications" onClick={() => undefined}>
              <BellIcon size={24} color="text" />
            </IconButton>
            <IconButton label="More" onClick={() => undefined}>
              <EllipsisIcon size={24} color="text" />
            </IconButton>
            <CloseIconButton onClick={() => undefined} />
          </Row>
          <Row label="Secondary plate (surfaceMuted) at 32 / 40 / 48; each hit area is at least 44">
            <IconButton
              label="Settings"
              size={32}
              background="surfaceMuted"
              onClick={() => undefined}
            >
              <SettingsIcon size={16} color="text" />
            </IconButton>
            <IconButton
              label="Settings"
              background="surfaceMuted"
              onClick={() => undefined}
            >
              <SettingsIcon size={20} color="text" />
            </IconButton>
            <IconButton
              label="Settings"
              size={48}
              background="surfaceMuted"
              onClick={() => undefined}
            >
              <SettingsIcon size={24} color="text" />
            </IconButton>
          </Row>
          <Row label="Disabled">
            <IconButton label="Settings" disabled onClick={() => undefined}>
              <SettingsIcon size={24} color="text" />
            </IconButton>
            <IconButton
              label="Settings"
              disabled
              background="surfaceMuted"
              onClick={() => undefined}
            >
              <SettingsIcon size={20} color="text" />
            </IconButton>
          </Row>
          <Row label="Menu trigger (aria-haspopup, expanded)">
            <IconButton
              label="More actions"
              aria-haspopup="menu"
              aria-expanded
              tooltip="default"
              onClick={() => undefined}
            >
              <EllipsisIcon size={24} color="text" />
            </IconButton>
          </Row>
          <Row label="Avatar trigger">
            <IconButton
              variant="avatar"
              label="Account"
              onClick={() => undefined}
              size={AVATAR_BUTTON_SIZE}
            >
              <UserIcon
                size={iconButtonAvatarContentSize(AVATAR_BUTTON_SIZE)}
              />
            </IconButton>
          </Row>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
