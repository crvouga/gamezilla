import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Self / device / auth snapshot for the space debug modal. */
export function SpaceDebugSelfSection(): ReactNode {
  const deviceService = useDeviceService();
  const auth = useAuth();
  const value = {
    deviceId: deviceService.getDeviceId(),
    accountId: auth.accountId,
    myId: auth.myId,
    isAuthenticated: auth.isAuthenticated,
    session: auth.session,
    providers: auth.providers,
  };
  return <JsonView label={<Trans>self</Trans>} value={value} />;
}
