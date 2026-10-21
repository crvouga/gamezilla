/** @jsxImportSource solid-js */
/**
 * Slots on the people-search results that another bounded context fills.
 *
 * Search knows how to find a person; it does not know they can be friended.
 * The friendship status and the add / accept / cancel pills belong to whoever
 * owns friendships, so search declares the hole from its own point of view
 * and the composition root — or, in a subsystem harness, nobody — fills it.
 *
 * Unfilled is a real state: search with no friends sub composed in shows
 * each result as a plain avatar + username row.
 */

import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { JSX } from 'solid-js';

export type SearchResultSlots = {
  /** One whole result row, including what pressing it does. */
  readonly userRow?: (user: UserSearchResult) => JSX.Element;
};

const SearchResultSlotsContext =
  defineContext<SearchResultSlots>('SearchResultSlots');

export const SearchResultSlotsProvider = SearchResultSlotsContext.Provider;

/** Slots filled by other subs, or an empty set when none are composed. */
export function useSearchResultSlots(): SearchResultSlots {
  return SearchResultSlotsContext.useOptional() ?? {};
}
