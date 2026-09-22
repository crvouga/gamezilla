/** @jsxImportSource solid-js */
/**
 * Billing's session tree: the bridge that shows the plan tier in the shell's
 * global menu. Loaded with the sync engine — it reads synced rows.
 */

import type { JSX } from 'solid-js';

import { MembershipMenuBridge } from './membership-menu-bridge';

export default function BillingSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <MembershipMenuBridge>{props.children}</MembershipMenuBridge>;
}
