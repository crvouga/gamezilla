/**
 * `ExplorerDetail` -- renders a single component example by name.
 *
 * Looks up the component in the registry and renders its Example. Reactive
 * to runtime registrations via {@link useComponentRegistry} when no
 * `entries` override is supplied. Pass `entries` to scope the lookup to a
 * caller-owned list (e.g. chess-only entries from chess settings).
 *
 * Pass `screenBodyBleed` when nested under a non-scrolling {@link ScreenBase}
 * body so the scrollbar stays flush with the screen edge.
 */

import { EmptyState } from '../empty-state';
import { ScreenBodyScrollView } from '../screen-base/screen-body-scroll-view';
import { ScrollView } from '../scroll-view';
import {
  useComponentRegistry,
  type ComponentEntry,
} from './component-registry';

export type ExplorerDetailProps = {
  componentName: string;
  entries?: readonly ComponentEntry[];
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar is flush. Omit outside ScreenBase (e.g. chess settings embeds).
   */
  screenBodyBleed?: boolean;
};

export function ExplorerDetail({
  componentName,
  entries,
  screenBodyBleed = false,
}: ExplorerDetailProps) {
  const globalRegistry = useComponentRegistry();
  const registry = entries ?? globalRegistry;
  const entry = registry.find((c) => c.name === componentName);

  if (!entry) {
    return (
      <EmptyState
        title="Component not found"
        body={`No example registered for "${componentName}".`}
      />
    );
  }

  const { Example } = entry;
  const body = <Example />;

  if (screenBodyBleed) {
    // ScreenBase body already insets via ContentEdgePadding; examples omit
    // their own outer padding so horizontal inset is applied once.
    return (
      <ScreenBodyScrollView sx={{ pb: 16 }}>{body}</ScreenBodyScrollView>
    );
  }

  // Outside ScreenBase (e.g. chess settings embeds): pad here once.
  return (
    <ScrollView style={{ flex: 1 }} sx={{ px: 4, pt: 4, pb: 16 }}>
      {body}
    </ScrollView>
  );
}
