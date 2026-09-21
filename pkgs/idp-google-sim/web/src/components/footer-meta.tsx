/**
 * What sits under the card. Google puts a language picker and Help / Privacy /
 * Terms there; none of those exist here, and rendering dead links that look
 * like a real provider's is the clone this screen is getting away from. So the
 * footer says what this actually is.
 */

import { IDP_BRAND } from '../../../src/shared/brand';
import { Icon } from './icon';

export function FooterMeta() {
  return (
    <footer class="mt-4 flex items-center gap-2 px-1 py-2 text-xs text-idp-on-surface-variant">
      <Icon name="info" class="size-4 shrink-0" />
      <span>
        {IDP_BRAND.name} — {IDP_BRAND.tagline}. Accounts and passwords here are
        local to this machine.
      </span>
    </footer>
  );
}
