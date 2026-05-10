import { useAuth } from '@gamezilla/auth/client/auth-context';
import { RegisterCommand } from '@gamezilla/lib/ui';
import { useAsync } from '@gamezilla/lib/async/use-async';
import { useLingui } from '@lingui/react/macro';

export function AccountCommand() {
  const { t } = useLingui();
  const auth = useAuth();
  const { run } = useAsync({
    operation: async () => {
      if (auth.isAuthenticated) {
        auth.openSignOutConfirm();
      } else {
        auth.openSignInModal();
      }
    },
  });
  return (
    <RegisterCommand
      id="auth-toggle"
      title={auth.isAuthenticated ? t`Sign out` : t`Sign in`}
      category={t`Account`}
      icon={
        auth.isAuthenticated ? 'arrow.right.from.bracket' : 'right.to.bracket'
      }
      keywords={[t`sign in`, t`login`, t`google`, t`auth`]}
      run={async () => {
        try {
          await run();
        } catch {
          // Hook state already tracks async errors.
        }
      }}
    />
  );
}
