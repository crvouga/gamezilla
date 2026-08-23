import pc from 'picocolors';

export function ok(label: string, detail?: string): void {
  const d = detail ? ` ${pc.dim('—')} ${detail}` : '';
  console.log(`${pc.green('✓')} ${label}${d}`);
}

export function info(label: string, detail?: string): void {
  const d = detail ? ` ${pc.dim('—')} ${detail}` : '';
  console.log(`${pc.dim('·')} ${label}${d}`);
}
