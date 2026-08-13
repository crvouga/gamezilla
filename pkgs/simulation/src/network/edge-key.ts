export function edgeKey(from: string, to: string): string {
  return `${from}\0${to}`;
}

export function parseEdgeKey(key: string): { from: string; to: string } {
  const idx = key.indexOf('\0');
  if (idx < 0) throw new Error(`invalid edge key: ${key}`);
  return { from: key.slice(0, idx), to: key.slice(idx + 1) };
}
