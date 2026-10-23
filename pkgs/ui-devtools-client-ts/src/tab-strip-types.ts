import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';

export type TabStripItem = {
  readonly id: string;
  readonly label: string;
  /** Optional leading icon rendered before the label. */
  readonly icon?: IconComponent | undefined;
  /** When set, show a close affordance; does not select the tab. */
  readonly onClose?: (() => void) | undefined;
};
