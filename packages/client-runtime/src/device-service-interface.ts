/**
 * Generic device-service contract: provides the install-stable device UUID.
 * The concrete factory lives in `@gamezilla/auth/client/device-service`; the
 * client-runtime atom holds the value but does not know how to construct one.
 */
export interface DeviceService {
  /** Stable per-install device UUID; never null. Crashes if invariant violated. */
  getDeviceId(): string;
}
