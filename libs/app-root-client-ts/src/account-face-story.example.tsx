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

/**
 * Avery's default face, at `size`: the same seed and the expression the
 * default avatar config draws for it, so the shell shows the face every
 * other story shows for Avery.
 */
export function storyAccountFace(size: number): JSX.Element {
  const svg = createAvatar(funEmoji, {
    seed: '5a1e0000-0000-4000-8000-000000000001',
    size,
    mouth: ['cute'],
    eyes: ['plain'],
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
