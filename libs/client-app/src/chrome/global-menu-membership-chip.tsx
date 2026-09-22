/** @jsxImportSource solid-js */
/** The global menu header's membership chip: brand-solid for a paying member. */

import { Handles } from '@libs/test-ids';
import { Badge } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { GlobalMenuMembership } from './global-menu-membership-context';

export function GlobalMenuMembershipChip(props: {
  readonly membership: GlobalMenuMembership;
}): JSX.Element {
  return (
    <Badge
      label={props.membership.label}
      size="sm"
      intent={props.membership.highlighted ? 'brand' : 'neutral'}
      tone={props.membership.highlighted ? 'solid' : 'subtle'}
      dataSet={{ testid: Handles.globalMenuMembership }}
    />
  );
}
