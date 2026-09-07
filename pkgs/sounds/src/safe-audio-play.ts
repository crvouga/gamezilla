export function isAutoplayBlockedError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  return 'name' in error && error.name === 'NotAllowedError';
}

/**
 * Shared audio objects are released on unmount / Fast Refresh. An in-flight
 * `seekTo` → `play()` that outlives that release throws
 * `NativeSharedObjectNotFoundException` — treat as a no-op, not a crash.
 */
export function isReleasedSharedObjectError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  return (
    message.includes('NativeSharedObjectNotFoundException') ||
    message.includes('Unable to find the native shared object')
  );
}

function isIgnorableAudioPlayError(error: unknown): boolean {
  return isAutoplayBlockedError(error) || isReleasedSharedObjectError(error);
}

/** Web browsers reject `play()` until the user has interacted with the page. */
export function playAudioOrIgnoreAutoplayBlock(
  play: () => void | Promise<void>,
  onBlocked: () => void = () => undefined
): void {
  try {
    const result = play();
    if (
      result !== undefined &&
      typeof (result as Promise<void>).then === 'function'
    ) {
      void (result as Promise<void>).catch((error: unknown) => {
        if (isIgnorableAudioPlayError(error)) {
          if (isAutoplayBlockedError(error)) onBlocked();
          return;
        }
        throw error;
      });
    }
  } catch (error) {
    if (isIgnorableAudioPlayError(error)) {
      if (isAutoplayBlockedError(error)) onBlocked();
      return;
    }
    throw error;
  }
}
