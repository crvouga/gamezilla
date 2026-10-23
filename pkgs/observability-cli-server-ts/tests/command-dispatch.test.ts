import { describe, expect, test } from 'bun:test';
import { parseArgs } from '@pkgs/observability-cli-shared-ts/args';
import { runCommand } from '@pkgs/observability-cli-shared-ts/commands';
import { HELP } from '@pkgs/observability-cli-shared-ts/help';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';
import { platformCommand } from '../src/platform-command';
import {
  createGymFixtures,
  GYM_IDS,
  GYM_MUTATION_ID,
  GYM_NOW_MS,
  GYM_PERSON,
  GYM_TEST_ID,
} from './gym-fixtures';

/** The commands `help` lists, in the order it lists them. */
function helpCommands(): string[] {
  return HELP.split('\n').flatMap((line) => {
    const match = /^ {2}([a-z]+) /.exec(line);
    return match?.[1] === undefined ? [] : [match[1]];
  });
}

/** One working invocation of each command in `help`. */
const INVOCATIONS: Readonly<Record<string, readonly string[]>> = {
  person: ['person', '--name', GYM_PERSON.name, '--at', GYM_PERSON.at],
  last: ['last', '--window', '1h', '--errors'],
  find: ['find', GYM_IDS.constraint],
  user: ['user', GYM_PERSON.userId, '--window', '1h'],
  trace: ['trace', GYM_IDS.constraint],
  span: ['span', GYM_IDS.constraint, '1000000000000001'],
  mutation: ['mutation', GYM_MUTATION_ID],
  test: ['test', GYM_TEST_ID],
  errors: ['errors', '--since', '24h'],
  slow: ['slow', '--since', '1h'],
  diff: ['diff', GYM_IDS.constraint, GYM_IDS.slowQuery],
  tail: ['tail', '--window', '10m'],
  schema: ['schema'],
};

async function context() {
  const files = await createGymFixtures();
  const values = new Map(Object.entries(files));
  return {
    nowMs: GYM_NOW_MS,
    store: new NdjsonTraceStore(
      {
        async get(key) {
          const value = values.get(key);
          if (value === undefined) return null;
          const bytes = new TextEncoder().encode(value);
          return {
            body: new Blob([bytes]).stream(),
            contentType: 'application/x-ndjson',
            size: bytes.byteLength,
          };
        },
        async put() {},
        async head(key) {
          return values.has(key);
        },
        async delete() {},
        async deleteMany() {},
        async getUri() {
          return null;
        },
        async listKeys() {
          return [...values.keys()].sort();
        },
        withPrefix() {
          return this;
        },
      },
      'dispatch'
    ),
    identityResolver: {
      resolve: async () => null,
      resolvePeople: async () => [
        { userId: GYM_PERSON.userId, matchedAs: 'name' as const },
      ],
    },
  };
}

describe('every command that help lists is a command', () => {
  test('help lists the commands this suite knows how to run', () => {
    expect(helpCommands().sort()).toEqual(
      [...Object.keys(INVOCATIONS), 'platform'].sort()
    );
  });

  test.each(Object.keys(INVOCATIONS))(
    '%s runs its own command, not usage or find',
    async (command) => {
      const result = await runCommand(
        await context(),
        parseArgs(INVOCATIONS[command] ?? [])
      );
      expect(result.code).toBeLessThan(2);
      expect(result.text).not.toBe(HELP);
      expect(result.text).not.toContain('usage: bun obs');
      expect(result.text).not.toContain(`No traces matched "${command}"`);
    }
  );

  test('errors lists the gym failures that find "errors" would never have', async () => {
    const result = await runCommand(
      await context(),
      parseArgs(['errors', '--since', '24h'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain(GYM_IDS.constraint);
    expect(result.text).toContain(GYM_IDS.clientError);
  });

  test('platform dispatches to the Cloudflare reader', async () => {
    const result = await platformCommand(
      parseArgs(['platform', '--service', 'api']),
      {
        http: { fetch: async () => new Response('{}', { status: 500 }) },
        nowMs: GYM_NOW_MS,
        accountId: 'account',
        token: 'token',
        signal: AbortSignal.timeout(1_000),
      }
    );
    expect(result.code).toBe(3);
    expect(result.text).not.toContain('usage');
  });

  test('a command help does not list is usage', async () => {
    const result = await runCommand(await context(), parseArgs(['nonsense']));
    expect(result.code).toBe(2);
    expect(result.text).toBe(HELP);
  });

  test('help itself exits 0', async () => {
    const result = await runCommand(await context(), parseArgs([]));
    expect(result.code).toBe(0);
    expect(result.text).toBe(HELP);
  });
});
