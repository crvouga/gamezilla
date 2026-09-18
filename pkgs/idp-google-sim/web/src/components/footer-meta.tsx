/** Language + policy row under the card; one line once the page is wide. */

import { Icon } from './icon';

const LINKS = ['Help', 'Privacy', 'Terms'] as const;

export function FooterMeta() {
  return (
    <footer class="mt-4 flex flex-col gap-2 px-3 py-2 text-xs text-gm-on-surface-variant min-[840px]:flex-row min-[840px]:items-center min-[840px]:justify-between">
      <span class="inline-flex items-center gap-2">
        <Icon name="globe" class="size-4" />
        English (United States)
      </span>
      <span class="flex gap-6">
        {LINKS.map((label) => (
          <span>{label}</span>
        ))}
      </span>
    </footer>
  );
}
