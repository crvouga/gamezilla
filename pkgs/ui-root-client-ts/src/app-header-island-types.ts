import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import type { IconComponent } from './create-icon/index';

export type AppHeaderIslandItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconComponent;
  readonly active: boolean;
  readonly onClick: () => void;
  /** DOM `data-*` identifiers for the tab. */
  readonly dataSet?: ComponentDataSet | undefined;
};

export type AppHeaderIslandProps = {
  /** Left slot (typically `AppLogo` or space Close/Back). */
  leading?: JSX.Element | undefined;
  /**
   * Primary nav pills rendered in the center. Omit or pass `[]` for chrome
   * that only uses leading + trailing (e.g. active space).
   */
  items?: readonly AppHeaderIslandItem[] | undefined;
  /**
   * Right slot (space actions, avatar menu, …). Defaults to the
   * `AppFrameChromeProvider` `globalTrailing` chrome when omitted.
   */
  trailing?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};
