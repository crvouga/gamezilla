/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createEffect, untrack } from 'solid-js';
import type { MutationStepProps } from '../mutation-step/index';
import { useMutationStep } from '../mutation-step/index';
import { ResponsiveSurface } from '../responsive-surface/index';

export { resolveMutationSurfaceClose } from '../mutation-step/index';

export type MutationModalProps = MutationStepProps & {
  visible: boolean;
  /** Stable surface-stack id; keeps this dialog above remounting underlays. */
  stackId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `MutationModal` -- one dialog for the whole mutation lifecycle.
 *
 * Always a centered modal via {@link ResponsiveSurface} `presentation="modal"`
 * (never a bottom sheet), `small`. A pure confirmation keeps a further inset
 * on a phone, so stacked over another surface it never reads as the same
 * panel; a form (`children`, a rename) takes the phone's full dialog width
 * so its field has room. Renders a confirm message or form body, then on
 * submit transitions through `loading -> success / error` in place. Closing
 * dismisses the observation without cancelling the operation. This is
 * the canonical surface for destructive confirms (sign out, end space) and
 * small form mutations (rename).
 *
 * The body is {@link useMutationStep}; its phases come from
 * `useMutationLifecycle` (shared with `useMutationButton`), so modal and
 * inline surfaces read the same way.
 *
 * @example
 * ```tsx
 * <MutationModal
 *   visible={open()}
 *   onClose={close}
 *   title={<Trans>End space?</Trans>}
 *   message={<Trans>Everyone will leave. This cannot be undone.</Trans>}
 *   submitLabel={<Trans>End space</Trans>}
 *   variant="destructive"
 *   operation={() => endSpace(spaceId)}
 *   successTitle={<Trans>Space ended</Trans>}
 * />
 * ```
 */
export function MutationModal(props: MutationModalProps): JSX.Element {
  const step = useMutationStep(props);
  // Every open starts from the confirm body again.
  createEffect(
    () => props.visible,
    (visible) => {
      // The phase as it stands at the open: a later phase change is not one.
      if (visible && untrack(step.phase) !== 'loading') step.reset();
    }
  );
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={step.close}
      closable
      // Once it is done the question is answered: the surface is titled with
      // the outcome ("Space ended"), never still asking "End space?".
      title={step.title()}
      presentation="modal"
      size="small"
      // A form needs the phone's width for its field; a confirm stays inset.
      inset={!('children' in props)}
      stackId={props.stackId}
      dataSet={{ component: 'MutationModal', ...props.dataSet }}
    >
      <step.Body />
    </ResponsiveSurface>
  );
}
