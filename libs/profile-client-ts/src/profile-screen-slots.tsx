/** @jsxImportSource solid-js */
/**
 * Slots on the profile screen that another bounded context fills.
 *
 * Profile knows a person has a profile; it does not know they have friends.
 * The friend count and the add/remove buttons belong to whoever owns
 * friendships, so profile declares the holes from its own point of view and
 * the composition root — or, in a subsystem harness, nobody — fills them.
 *
 * Unfilled is a real state, not a degraded one: a profile with no friends
 * sub composed in simply has no friends row.
 */

import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { JSX } from 'solid-js';

export type ProfileScreenSlots = {
  /** The friends panel's row to the friends list, with their faces. */
  readonly stats?: () => JSX.Element;
  /** How many friends: the number the identity's Friends fact shows. */
  readonly count?: () => JSX.Element;
  /** Actions in the profile header (e.g. add friend / unblock). */
  readonly actions?: () => JSX.Element;
  /** The rooms friends are playing in now: the main section, before the friends panel. */
  readonly playing?: () => JSX.Element;
};

const ProfileScreenSlotsContext =
  defineContext<ProfileScreenSlots>('ProfileScreenSlots');

export const ProfileScreenSlotsProvider = ProfileScreenSlotsContext.Provider;

/** Slots filled by other subs, or an empty set when none are composed. */
export function useProfileScreenSlots(): ProfileScreenSlots {
  return ProfileScreenSlotsContext.useOptional() ?? {};
}
