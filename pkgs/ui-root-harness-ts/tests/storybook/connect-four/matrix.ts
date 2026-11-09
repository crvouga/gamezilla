export function boardContext(width: number) {
  const size = { width, height: width < 768 ? 844 : 1024 };
  return {
    viewport: size,
    video: { mode: 'on' as const, size },
    trace: 'on' as const,
    hasTouch: true,
  };
}
