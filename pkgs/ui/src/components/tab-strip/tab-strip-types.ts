export type TabStripItem = {
  readonly id: string;
  readonly label: string;
  /** When set, show a close affordance; does not select the tab. */
  readonly onClose?: () => void;
};
