import assert from 'node:assert/strict';

export function ghError(message: string): void {
  assert(typeof message === 'string' && message.length > 0);
  console.error(`::error::${message}`);
}

export function ghNotice(message: string): void {
  assert(typeof message === 'string' && message.length > 0);
  console.log(`::notice::${message}`);
}
