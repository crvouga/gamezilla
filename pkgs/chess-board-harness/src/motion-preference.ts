// @io-wall-ok — browser contract composition controls the OS preference port.
/** Drive the real matchMedia subscription rather than bypassing motion policy. */
export function installMotionPreference() {
  const matchMedia = window.matchMedia.bind(window);
  let reduced = false;
  let current: MediaQueryList | undefined;
  window.matchMedia = (query) => {
    const media = matchMedia(query);
    if (query === '(prefers-reduced-motion: reduce)') {
      Object.defineProperty(media, 'matches', { get: () => reduced });
      current = media;
    }
    return media;
  };
  return (value: boolean) => {
    reduced = value;
    current?.dispatchEvent(new Event('change'));
  };
}
