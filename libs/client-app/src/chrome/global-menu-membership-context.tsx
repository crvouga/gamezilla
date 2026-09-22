/** @jsxImportSource solid-js */
/**
 * The membership chip in the global menu's header. Like the identity, it is
 * read from synced rows the chrome cannot query (it mounts above the SQLite
 * gate), so the feature that owns membership publishes a label into this
 * signal from inside the sync tree. A shell composed without that feature
 * never publishes, and the menu simply shows no chip.
 *
 * The shell does not know what the tiers are: it is handed a label and
 * whether to highlight it.
 */

import { defineContext } from '@pkgs/solid-context/define-context';
import { type Accessor, createSignal, type JSX } from 'solid-js';

export type GlobalMenuMembership = {
  /** Short, already-translated label ("Free", "Paid"). */
  readonly label: string;
  /** Draw the chip in the brand tone (a paying member). */
  readonly highlighted: boolean;
};

type GlobalMenuMembershipPublisher = (
  membership: GlobalMenuMembership | null
) => void;

const GlobalMenuMembershipContext = defineContext<
  Accessor<GlobalMenuMembership | null>
>('GlobalMenuMembership');

const GlobalMenuMembershipPublisherContext =
  defineContext<GlobalMenuMembershipPublisher>('GlobalMenuMembershipPublisher');

export const useGlobalMenuMembership = GlobalMenuMembershipContext.use;

export function useGlobalMenuMembershipPublisher(): GlobalMenuMembershipPublisher {
  return GlobalMenuMembershipPublisherContext.use();
}

/** Boot stub: no chip until a feature publishes one. */
export function GlobalMenuMembershipRoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [membership, setMembership] = createSignal<GlobalMenuMembership | null>(
    null
  );
  return (
    <GlobalMenuMembershipContext.Provider value={membership}>
      <GlobalMenuMembershipPublisherContext.Provider value={setMembership}>
        {props.children}
      </GlobalMenuMembershipPublisherContext.Provider>
    </GlobalMenuMembershipContext.Provider>
  );
}
