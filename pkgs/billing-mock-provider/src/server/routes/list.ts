/**
 * Stripe's list envelope and cursor pagination: newest first, `limit`
 * (1–100, default 10), `starting_after` / `ending_before` an object id, and
 * `has_more` when the page stopped short of the end.
 */
import type { MockList } from '@pkgs/billing-mock/wire';

import { invalidRequest, resourceMissing } from '../errors';
import { type Body, optionalInteger, optionalString } from './request';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function limitOf(params: Body): number {
  const limit = optionalInteger(params, 'limit') ?? DEFAULT_LIMIT;
  if (limit < 1 || limit > MAX_LIMIT) {
    throw invalidRequest(
      `This value must be between 1 and ${String(MAX_LIMIT)}.`,
      'limit'
    );
  }
  return limit;
}

function cursorIndex(
  items: readonly { readonly id: string }[],
  id: string,
  param: string
): number {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw resourceMissing(`object for ${param}`, id);
  return index;
}

/** One page of `items` (already newest first), as the wire's list. */
export function page<T extends { readonly id: string }>(
  url: string,
  items: readonly T[],
  params: Body
): MockList<T> {
  const limit = limitOf(params);
  const after = optionalString(params, 'starting_after');
  const before = optionalString(params, 'ending_before');
  if (after !== undefined && before !== undefined) {
    throw invalidRequest(
      'You may only specify one of these parameters: ending_before, starting_after.'
    );
  }
  if (before !== undefined) {
    const end = cursorIndex(items, before, 'ending_before');
    const start = Math.max(0, end - limit);
    return {
      object: 'list',
      data: items.slice(start, end),
      has_more: start > 0,
      url,
    };
  }
  const start =
    after === undefined ? 0 : cursorIndex(items, after, 'starting_after') + 1;
  return {
    object: 'list',
    data: items.slice(start, start + limit),
    has_more: start + limit < items.length,
    url,
  };
}
