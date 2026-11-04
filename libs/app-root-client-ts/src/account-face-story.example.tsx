/** @jsxImportSource solid-js */
/**
 * The signed-in person's face for the shell's stories. In the product the
 * profile sub publishes it (a DiceBear face drawn from the person's avatar
 * config); the shell may not import profile, so its stories draw the same
 * kind of face from DiceBear directly.
 */

import { funEmoji } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';
import type { GlobalMenuIdentity } from '@libs/app-env-client-ts/global-menu-identity-context';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import type { JSX } from 'solid-js';

/** Avery's friendly default face, at `size`. */
export function storyAccountFace(size: number): JSX.Element {
  const svg = createAvatar(funEmoji, {
    seed: 'avery',
    size,
    mouth: ['wideSmile'],
    eyes: ['cute'],
    randomizeIds: true,
  }).toString();
  return <Avatar size={size} background="surface" svg={svg} />;
}

/** Avery, signed in, as the identity bridge publishes them. */
export const STORY_SIGNED_IN_IDENTITY: GlobalMenuIdentity = {
  usernameLabel: '@avery',
  email: 'avery@example.test',
  avatar: storyAccountFace,
};
