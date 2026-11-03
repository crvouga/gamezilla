import { t } from '@lingui/core/macro';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { type JSX, Show } from 'solid-js';
import type { DenialView } from './denial-surface-view';

export type DenialModalViewProps = {
  /** The resolved denial; its `dataSet.testid` names the modal's buttons. */
  readonly denial: DenialView;
  readonly visible: boolean;
  /** Closes the modal; the denial itself stands until its owner answers it. */
  readonly onDismiss: () => void;
};

/**
 * Presentational half of `DenialModal`: already-resolved denial copy as a
 * centered modal. With a way forward it offers it beside "Not now"; without
 * one it offers "OK". Taking the way forward closes the modal first, so it
 * never covers where it leads. Only `DenialModal` resolves a `Decision`.
 */
export function DenialModalView(props: DenialModalViewProps): JSX.Element {
  const testId = (): string =>
    props.denial.dataSet['testid'] ?? 'permission-denial';
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={() => props.onDismiss()}
      title={props.denial.title}
      presentation="modal"
      size="small"
      dataSet={{ component: 'DenialModal', ...props.denial.dataSet }}
    >
      <ModalBody message={props.denial.body} />
      <ModalFooter>
        <Show when={props.denial.action}>
          {(forward) => (
            <ModalButton
              label={forward().label}
              onClick={() => {
                props.onDismiss();
                forward().onPress();
              }}
              dataSet={{ testid: `${testId()}-action` }}
            />
          )}
        </Show>
        <ModalButton
          label={props.denial.action === undefined ? t`OK` : t`Not now`}
          variant={props.denial.action === undefined ? 'default' : 'cancel'}
          onClick={() => props.onDismiss()}
          dataSet={{ testid: `${testId()}-dismiss` }}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
