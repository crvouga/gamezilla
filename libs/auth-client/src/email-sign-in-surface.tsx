/**
 * Child of the sign-in surface: the emailed-link form, opened by "Continue
 * with email". Submitting the link hands the attempt back to the sign-in
 * surface, which shows its progress and outcome.
 */

import { useLingui } from '@lingui/solid/macro';
import { ModalBody } from '@pkgs/ui-root-client/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import type { JSX } from 'solid-js';
import { EmailSignInForm } from './email-sign-in-form';
import { useEmailSignIn } from './use-email-sign-in';

export function EmailSignInSurface(props: {
  visible: boolean;
  onClose: () => void;
  start: (runner: () => Promise<void>) => Promise<void>;
  /** Set when signing in proves an existing account to attach a new method. */
  pendingLink: string | null;
}): JSX.Element {
  const { t } = useLingui();
  const form = useEmailSignIn({
    visible: () => props.visible,
    start: (runner) => props.start(runner),
    pendingLink: () => props.pendingLink,
  });
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={t`Continue with email`}
      presentation="modal"
      stackId="email-sign-in"
    >
      <ModalBody>
        <EmailSignInForm form={form} />
      </ModalBody>
    </ResponsiveSurface>
  );
}
