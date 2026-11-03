import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import type { JSX } from 'solid-js';
import { DenialModalView } from './denial-modal-view';
import { useDenialView } from './denial-surface';

export type DenialModalProps = {
  readonly decision: Decision;
  readonly visible: boolean;
  /** Closes the modal; the denial itself stands until its owner answers it. */
  readonly onDismiss: () => void;
  readonly icon?: IconComponent | undefined;
  /**
   * `data-testid` for spec / harness handles; the CTA is `<testId>-action`
   * and "Not now" is `<testId>-dismiss`.
   */
  readonly testId?: string;
};

/**
 * `DenialSurface` as an alert: a centered modal that says what was refused
 * and offers the configured way forward. Taking it closes the modal (so it
 * never covers where it leads); "Not now" closes it and changes nothing.
 * Resolves the `Decision` and renders `DenialModalView`.
 */
export function DenialModal(props: DenialModalProps): JSX.Element {
  const denial = useDenialView(props);
  return (
    <DenialModalView
      denial={denial()}
      visible={props.visible}
      onDismiss={() => props.onDismiss()}
    />
  );
}
