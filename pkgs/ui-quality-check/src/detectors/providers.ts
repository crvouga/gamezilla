/** Candidate policy for adapters; listed providers can live in separate native libraries. */
export function executionProviderCandidates(
  available: readonly { readonly name: string; readonly bundled: boolean }[],
  requested = 'auto'
): readonly string[] {
  if (requested !== 'auto') return [requested];
  const supported = new Set(available.map((provider) => provider.name));
  return ['cuda', 'webgpu', 'dml', 'cpu'].filter((provider) =>
    supported.has(provider)
  );
}
