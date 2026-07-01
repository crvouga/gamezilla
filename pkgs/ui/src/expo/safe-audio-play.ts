export function isAutoplayBlockedError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  return 'name' in error && error.name === 'NotAllowedError';
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
        if (isAutoplayBlockedError(error)) {
          onBlocked();
          return;
        }
        throw error;
      });
    }
  } catch (error) {
    if (isAutoplayBlockedError(error)) {
      onBlocked();
      return;
    }
    throw error;
  }
}
