/**
 * Gather each failing objective's evidence with its own investigate command
 * (read-only `bun obs` searches, `--json`, the command's bounded window and
 * the store's result limit) and open a few example traces, inside one time
 * budget. Nothing here can fail the caller: a query that cannot run becomes
 * evidence that says why.
 */

import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import type { AlertEvidence, WorkItemsDocument } from './alert-work-items';
import {
  buildWorkItem,
  evidenceArgs,
  exampleTraces,
  groupFailures,
  investigateCommand,
  missingEvidence,
  orderWorkItems,
  searchTraces,
  summarizeEvidence,
  traceArgs,
  traceMessages,
} from './alert-work-items';

export type ObsOutcome = {
  /** Exit code, or `null` when the process was stopped (deadline). */
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type EvidencePorts = {
  /** Runs `bun obs <args>` with CI's credentials. */
  readonly obs: (args: readonly string[]) => ObsOutcome;
  readonly nowMs: () => number;
  /** No query starts after this. */
  readonly deadlineMs: number;
};

/** Traces opened per work item for their error messages. */
const OPENED_TRACES = 3;

/** What `bun obs` said when it failed, its preamble and hints left out. */
function whatObsSaid(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l !== '' &&
        !l.startsWith('obs/v1') &&
        !l.startsWith('source:') &&
        !l.startsWith('next:')
    );
  const errors = lines.filter((l) => /^(error:|store unreachable:)/i.test(l));
  const said = errors.length > 0 ? errors : lines;
  return said.length === 0 ? 'no output' : said.join('; ');
}

export function collectEvidence(
  failures: readonly ObjectiveFailure[],
  ports: EvidencePorts
): AlertEvidence {
  const command = investigateCommand(failures);
  const args = evidenceArgs(command);
  if (args === null) {
    return missingEvidence(
      command,
      'skipped',
      command === null
        ? 'the objective gives no investigate command'
        : 'only read-only bun obs searches (errors, slow, last) are run'
    );
  }
  if (ports.nowMs() >= ports.deadlineMs)
    return missingEvidence(
      command,
      'skipped',
      'the evidence time budget was spent'
    );
  const search = ports.obs(args);
  const found = searchTraces(search.stdout);
  if (found === null) {
    const why =
      search.code === null
        ? 'the query did not finish in time'
        : `bun obs exited ${String(search.code)}: ${whatObsSaid(search.stderr || search.stdout)}`;
    return missingEvidence(command, 'unavailable', why);
  }
  const opened: string[] = [];
  for (const ref of exampleTraces(found.traces).slice(0, OPENED_TRACES)) {
    if (ports.nowMs() >= ports.deadlineMs) break;
    opened.push(ports.obs(traceArgs(args, ref.traceId)).stdout);
  }
  return summarizeEvidence({
    command: `bun obs ${args.join(' ')}`,
    traces: found.traces,
    truncated: found.truncated,
    messages: traceMessages(opened),
  });
}

/** Every failure as work items, most urgent first, each with its evidence. */
export function buildWorkItemsDocument(input: {
  readonly failures: readonly ObjectiveFailure[];
  readonly environments: readonly string[];
  readonly generatedAt: string;
  readonly ports: EvidencePorts;
}): WorkItemsDocument {
  const ordered = orderWorkItems(groupFailures(input.failures));
  return {
    version: 1,
    generatedAt: input.generatedAt,
    environments: input.environments,
    items: ordered.map((failures) =>
      buildWorkItem(failures, collectEvidence(failures, input.ports))
    ),
  };
}
