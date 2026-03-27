import assert from 'node:assert/strict';

export function ghError(message: string): void {
  assert(typeof message === 'string');
  console.error(`::error::${message}`);
}

export function ghNotice(message: string): void {
  assert(typeof message === 'string');
  console.log(`::notice::${message}`);
}

export function ghWarning(message: string): void {
  assert(typeof message === 'string');
  console.log(`::warning::${message}`);
}

export function mustEnv(value: string | undefined, label: string): string {
  assert(typeof label === 'string' && label.length > 0);
  if (value === undefined || value.trim() === '') {
    ghError(`Missing or empty required env: ${label}`);
    process.exit(1);
  }
  assert(typeof value === 'string' && value.trim().length > 0);
  return value;
}
