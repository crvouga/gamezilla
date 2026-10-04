/** @jsxImportSource solid-js */
/**
 * Embedded-only: mirror MemoryRouter location into client Kv so the next
 * spawn (and snapshot remount with seeded history) restores the same path.
 */

import { writeEmbeddedHref } from '@libs/app-shared/embedded-href';
import { useKv } from '@pkgs/kv-client/solid';
import { useLocation } from '@solidjs/router';
import { createEffect, type JSX, on } from 'solid-js';

function locationHref(pathname: string, search: string, hash: string): string {
  return `${pathname}${search}${hash}`;
}

export function EmbeddedHrefPersistence(): JSX.Element {
  const kv = useKv();
  const location = useLocation();
  createEffect(
    on(
      () => locationHref(location.pathname, location.search, location.hash),
      (href) => {
        void writeEmbeddedHref(kv, href);
      }
    )
  );
  return null;
}
