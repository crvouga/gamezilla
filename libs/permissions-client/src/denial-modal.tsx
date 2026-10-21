import { t } from '@lingui/core/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import type { IconComponent } from '@pkgs/ui-root-client/create-icon';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { type JSX, Show } from 'solid-js';
import { useDenialContent } from './denial-surface';

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
 */
export function DenialModal(props: DenialModalProps): JSX.Element {
  const content = useDenialContent(props);
  const testId = (): string => props.testId ?? 'permission-denial';
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={() => props.onDismiss()}
      title={content.title()}
      presentation="modal"
      size="small"
      dataSet={{ component: 'DenialModal', ...content.dataSet() }}
    >
      <ModalBody message={content.body()} />
      <ModalFooter>
        <Show when={content.action()}>
          {(forward) => (
            <ModalButton
              label={forward().label}
              onClick={() => {
                props.onDismiss();
                forward().run();
              }}
              dataSet={{ testid: `${testId()}-action` }}
            />
          )}
        </Show>
        <ModalButton
          label={content.action() === undefined ? t`OK` : t`Not now`}
          variant={content.action() === undefined ? 'default' : 'cancel'}
          onClick={() => props.onDismiss()}
          dataSet={{ testid: `${testId()}-dismiss` }}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
