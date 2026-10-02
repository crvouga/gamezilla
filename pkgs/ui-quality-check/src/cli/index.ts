#!/usr/bin/env node
// @io-wall-ok — CLI process entrypoint.
import { parseArguments } from './arguments';
import { executeCommand } from './commands';
import { HELP } from './help';
import { errorMessage } from '../errors';

try {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    console.log(args.json ? JSON.stringify({ schemaVersion: 1, help: HELP }) : HELP);
  } else {
    const result = await executeCommand(args);
    console.log(args.json ? JSON.stringify(result.value) : result.text);
    process.exitCode = result.exitCode;
  }
} catch (error) {
  if (process.argv.includes('--json')) console.log(JSON.stringify({ schemaVersion: 1, error: { kind: 'tooling', message: errorMessage(error) } }));
  else console.error(`UI quality check error: ${errorMessage(error)}`);
  process.exitCode = 2;
}
