export function isNode() {
  return typeof process !== 'undefined' && typeof process.exit === 'function';
}

export function crashNode(
  _message: string,
  _context?: Record<string, unknown>
) {
  process.exit(1);
}
