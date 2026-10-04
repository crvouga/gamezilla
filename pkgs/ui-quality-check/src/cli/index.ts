#!/usr/bin/env node
import { errorMessage } from '../errors';
// @io-wall-ok — CLI process entrypoint.
import { parseArguments } from './arguments';
import { executeCommand } from './commands';
import { HELP } from './help';

const cancellation = new AbortController();
const cancel = () =>
  cancellation.abort(new Error('UI quality check cancelled.'));
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  const args = parseArguments(process.argv.slice(2));
  args.options = { ...args.options, signal: cancellation.signal };
  if (args.help) {
    print(args.json ? JSON.stringify({ schemaVersion: 1, help: HELP }) : HELP);
  } else {
    const result = await executeCommand(args);
    print(args.json ? JSON.stringify(result.value) : result.text);
    process.exitCode = result.exitCode;
  }
} catch (error) {
  if (process.argv.includes('--json'))
    print(
      JSON.stringify({
        schemaVersion: 1,
        error: { kind: 'tooling', message: errorMessage(error) },
      })
    );
  else process.stderr.write(`UI quality check error: ${errorMessage(error)}\n`);
  process.exitCode = 2;
} finally {
  process.off('SIGINT', cancel);
  process.off('SIGTERM', cancel);
}

function print(value: string): void {
  process.stdout.write(`${value}\n`);
}
