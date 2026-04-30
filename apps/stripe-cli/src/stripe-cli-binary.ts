import { STRIPE_CLI_LOG_TAG } from './constants';
import { asReadableUint8Stream } from './readable-stream-lines';

/** Ensure `bun x stripe` resolves (native Stripe CLI on PATH). */
export async function exitUnlessStripeCliWorks(repoRoot: string): Promise<void> {
  const proc = Bun.spawn([process.execPath, 'x', 'stripe', 'version'], {
    cwd: repoRoot,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const code = await proc.exited;
  if (code === 0) return;
  const errStream = asReadableUint8Stream(proc.stderr);
  const errText =
    errStream !== undefined ? await new Response(errStream).text() : '';
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] \`bun x stripe\` failed (exit ${String(code)}). Install the Stripe CLI, e.g.:`,
    '\n  brew install stripe/stripe-cli/stripe',
    errText.length > 0 ? `\n${errText}` : ''
  );
  process.exit(1);
}
