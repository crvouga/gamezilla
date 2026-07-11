import { mapAppAuthToWriteContext } from '../shared/map-app-auth-to-write-context';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  useMyAccountId,
  useMyDeviceId,
  useMyId,
} from './use-current-user';

export function useWriteContext(
  memberOfSpaceIds: readonly string[] = []
): WriteContext {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const myId = useMyId();
  return mapAppAuthToWriteContext({ deviceId, accountId, myId }, memberOfSpaceIds);
}

export function buildWriteContext(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly memberOfSpaceIds?: readonly string[];
}): WriteContext {
  return mapAppAuthToWriteContext(
    {
      deviceId: args.deviceId,
      accountId: args.accountId,
      myId: args.myId,
    },
    args.memberOfSpaceIds ?? []
  );
}
