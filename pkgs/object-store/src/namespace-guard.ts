/**
 * Validates a wire key before any remote object-store I/O. Every S3 command
 * for the shared bucket must pass this gate so projects cannot clobber
 * each other's prefixes.
 */
export function assertRemoteObjectKey(key: string, namespace: string): void {
  if (key.length === 0) {
    throw new Error('Remote object key must be non-empty');
  }
  if (key.startsWith('/')) {
    throw new Error(`Remote object key must not start with "/": ${key}`);
  }
  if (key.includes('..')) {
    throw new Error(`Remote object key must not contain "..": ${key}`);
  }
  const bareNamespace = namespace.endsWith('/')
    ? namespace.slice(0, -1)
    : namespace;
  if (key === namespace || key === bareNamespace) {
    throw new Error(
      `Remote object key must include a path after "${namespace}": ${key}`
    );
  }
  if (!key.startsWith(namespace)) {
    throw new Error(`Remote object key must start with "${namespace}": ${key}`);
  }
}

/**
 * Validates a logical key before {@link ObjectStoreWithPrefix} scopes it under
 * a namespace or feature prefix.
 */
export function assertLogicalObjectKey(key: string): void {
  if (key.length === 0) {
    throw new Error('Object store key must be non-empty');
  }
  if (key.startsWith('/')) {
    throw new Error(`Object store key must not start with "/": ${key}`);
  }
  if (key.includes('..')) {
    throw new Error(`Object store key must not contain "..": ${key}`);
  }
}
