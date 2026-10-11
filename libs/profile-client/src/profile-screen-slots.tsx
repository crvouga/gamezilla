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

import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { JSX } from 'solid-js';

export type ProfileScreenSlots = {
  /** Summary line under the identity block (e.g. friend count). */
  readonly stats?: () => JSX.Element;
  /** Actions in the profile header (e.g. add friend / unblock). */
  readonly actions?: () => JSX.Element;
};

const ProfileScreenSlotsContext =
  defineContext<ProfileScreenSlots>('ProfileScreenSlots');

export const ProfileScreenSlotsProvider = ProfileScreenSlotsContext.Provider;

/** Slots filled by other subs, or an empty set when none are composed. */
export function useProfileScreenSlots(): ProfileScreenSlots {
  return ProfileScreenSlotsContext.useOptional() ?? {};
}
