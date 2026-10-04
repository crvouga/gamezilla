/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { IconButton, iconButtonAvatarContentSize } from './icon-button';
import { UserIcon } from './icons';

const AVATAR_BUTTON_SIZE = 40;

export default function IconButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {'Hover or focus to see tooltips.'}
      </p>

      <div class="box flex-row gap-3 items-center">
        <IconButton
          label="Close"
          onClick={() => undefined}
          background="surface"
        >
          <p class="text">{'✕'}</p>
        </IconButton>

        <IconButton
          label="Add"
          onClick={() => undefined}
          size={48}
          background="tint"
        >
          <p class="text textBodyBold">{'+'}</p>
        </IconButton>

        <IconButton
          label="Delete"
          onClick={() => undefined}
          size={32}
          background="destructive"
        >
          <p class="text text-xs">{'🗑'}</p>
        </IconButton>

        <IconButton
          label="Settings"
          disabled
          onClick={() => undefined}
          background="surface"
        >
          <p class="text">{'⚙'}</p>
        </IconButton>

        <IconButton
          variant="avatar"
          label="Account"
          onClick={() => undefined}
          size={AVATAR_BUTTON_SIZE}
        >
          <UserIcon size={iconButtonAvatarContentSize(AVATAR_BUTTON_SIZE)} />
        </IconButton>
      </div>
    </ExampleRoot>
  );
}
