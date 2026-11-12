import { registerFeedbackContext } from '@pkgs/feedback-shared-ts/context';
import { onCleanup } from 'solid-js';
import { useHasAuthSession } from './access-facts';
import { useCurrentAccountId } from './use-current-account-id';

/** The feedback context a bug report reads to tell the team who sent it. */
export const BUG_REPORT_ACCOUNT_CONTEXT = 'account';

/**
 * Names the account in every bug report sent while a person is signed in. A
 * guest's app has a local id too, which is no account: theirs names none, so
 * the team is told a guest sent it.
 */
export function useBugReportAccount(): void {
  const hasSession = useHasAuthSession();
  const accountId = useCurrentAccountId();
  onCleanup(
    registerFeedbackContext({
      name: BUG_REPORT_ACCOUNT_CONTEXT,
      collect: () => (hasSession() ? { id: accountId() } : {}),
    })
  );
}
