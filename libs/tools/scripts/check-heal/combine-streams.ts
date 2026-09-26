export function combineStreams(stdout: Uint8Array, stderr: Uint8Array): string {
  const dec = new TextDecoder();
  const out = dec.decode(stdout).trimEnd();
  const err = dec.decode(stderr).trimEnd();
  const parts: string[] = [];
  if (err !== '') parts.push('--- stderr ---\n' + err);
  if (out !== '') parts.push('--- stdout ---\n' + out);
  return parts.length > 0 ? parts.join('\n\n') : '(no output)';
}
