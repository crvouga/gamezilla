import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useMyDeviceId } from '@libs/auth-client-ts/use-current-user';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth-client-ts/use-fresh-auth-token';
import { SPACE_ROOM_MODULE_NAME } from '@libs/spaces-shared-ts/space-room-module-name';
import { apiUrlToRoomAdmissionUrl } from '@libs/spaces-shared-ts/space-room-url';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import { type Accessor, untrack } from 'solid-js';

/**
 * What the room gateway said about this device and the space's room:
 * `refused` is the gateway's own word that the room will not take the
 * device (the space is gone, or the device is no longer in it). Anything
 * else — admitted, a session to renew, a server error, no answer — means
 * the room may still take the device, so it keeps trying.
 */
export type SpaceRoomAdmission =
  | { readonly verdict: 'admitted' }
  | { readonly verdict: 'refused'; readonly reason: string }
  | { readonly verdict: 'unknown'; readonly reason: string };

async function refusalReason(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { readonly error?: unknown };
    return typeof body.error === 'string' ? body.error : 'refused';
  } catch {
    return 'refused';
  }
}

/** Read a gateway answer; only an explicit `403` is a refusal. */
export async function readSpaceRoomAdmission(
  response: Response
): Promise<SpaceRoomAdmission> {
  if (response.ok) return { verdict: 'admitted' };
  if (response.status === 403)
    return { verdict: 'refused', reason: await refusalReason(response) };
  return { verdict: 'unknown', reason: `status ${response.status}` };
}

/** Ask the room gateway whether the space's room would admit this device. */
export function useSpaceRoomAdmission(
  spaceId: Accessor<string>
): () => Promise<SpaceRoomAdmission> {
  const http = useHttpClient();
  const configService = useConfigService();
  const deviceId = useMyDeviceId();
  const ambientToken = useFreshAuthToken();
  const getFreshToken = useGetFreshAuthToken();
  return async () => {
    try {
      const token =
        (await getFreshToken().catch(() => null)) ?? untrack(ambientToken);
      const response = await http.fetch(
        apiUrlToRoomAdmissionUrl({
          apiUrl: configService.getApiUrl(),
          topic: `space:${untrack(spaceId)}`,
          module: SPACE_ROOM_MODULE_NAME,
          sessionToken: token,
          installId: untrack(deviceId),
          clientId: null,
        })
      );
      return await readSpaceRoomAdmission(response);
    } catch (cause) {
      return {
        verdict: 'unknown',
        reason: cause instanceof Error ? cause.message : String(cause),
      };
    }
  };
}
