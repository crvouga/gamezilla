import type { ReactNode } from 'react';

import type { IconComponent } from '../icons';

export type AppHeaderIslandItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconComponent;
  readonly active: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
};

export type AppHeaderIslandProps = {
  /** Left slot (typically {@link AppLogo} or space Close/Back). */
  leading?: ReactNode;
  /**
   * Primary nav pills rendered in the center. Omit or pass `[]` for chrome
   * that only uses leading + trailing (e.g. active space).
   */
  items?: readonly AppHeaderIslandItem[];
  /** Right slot (space actions, avatar menu, …). */
  trailing?: ReactNode;
};
