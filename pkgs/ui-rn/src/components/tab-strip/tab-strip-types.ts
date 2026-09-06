import type { IconComponent } from '../icons';

export type TabStripItem = {
  readonly id: string;
  readonly label: string;
  /** Optional leading icon rendered before the label. */
  readonly icon?: IconComponent;
  /** When set, show a close affordance; does not select the tab. */
  readonly onClose?: () => void;
};
