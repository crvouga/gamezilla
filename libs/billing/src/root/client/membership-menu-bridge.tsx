/** @jsxImportSource solid-js */
/**
 * Publishes the caller's plan tier into the shell's global menu, where it
 * shows as a chip on its own row under the account name. Mounts inside the sync tree (the
 * tier is read from synced rows); the menu itself sits above the local
 * database gate and only sees the published label. Nothing is published
 * while billing is switched off, so the menu shows no chip.
 */

import { useGlobalMenuMembershipPublisher } from '@libs/client-app/chrome/global-menu-membership-context';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { useLingui } from '@lingui/solid/macro';
import { createEffect, type JSX, onCleanup } from 'solid-js';

import { type BillingTier, membershipMenuEntry } from './billing-view-model';
import { useBillingTier } from './use-billing-tier';

export function MembershipMenuBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  const publish = useGlobalMenuMembershipPublisher();
  const tier = useBillingTier();
  const { config } = useClientConfig();
  const label = (current: BillingTier): string => {
    if (current === 'paid') return t`Plus`;
    if (current === 'free') return t`Free`;
    return t`Guest`;
  };
  createEffect(() => {
    const entry = membershipMenuEntry(tier(), config().billing_enabled);
    publish(
      entry === null
        ? null
        : { label: label(entry.tier), highlighted: entry.highlighted }
    );
  });
  onCleanup(() => publish(null));
  return props.children;
}
