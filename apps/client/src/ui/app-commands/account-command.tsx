import { useAuth } from '@gamezilla/client/auth/auth-context';
import { RegisterCommand } from '@gamezilla/lib/ui';
import { useAsync } from '@gamezilla/lib/async/use-async';

export function AccountCommand() {
  const auth = useAuth();
  const { run } = useAsync({
    operation: async () => {
      if (auth.mode === 'signed-in') {
        auth.openSignOutConfirm();
      } else {
        auth.openSignInModal();
      }
    },
  });
  return (
    <RegisterCommand
      id="auth-toggle"
      title={auth.mode === 'signed-in' ? 'Sign out' : 'Sign in'}
      category="Account"
      icon={
        auth.mode === 'signed-in'
          ? 'arrow.right.from.bracket'
          : 'right.to.bracket'
      }
      keywords={['sign in', 'login', 'google', 'auth']}
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
