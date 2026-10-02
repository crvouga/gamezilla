import type { HttpClient } from '@pkgs/http-client';
import { z } from 'zod';
import type { WorkerDomain, WorkerNamespace } from './worker-lifecycle';

const namespaceSchema = z.object({
  id: z.string(),
  script: z.string(),
  class: z.string(),
});
const domainSchema = z.object({ hostname: z.string(), service: z.string() });
const bindingSchema = z.object({
  name: z.string(),
  type: z.string(),
  namespace_id: z.string().optional(),
});
const MISSING_WORKER = Symbol('missing-worker');
const missingWorkerSchema = z.object({
  success: z.literal(false),
  errors: z.array(z.object({ code: z.number() })),
});

/** Read-only account inventory, injected so migration checks run offline. */
export class WorkerState {
  constructor(
    private readonly http: HttpClient,
    private readonly accountId: string,
    private readonly token: string
  ) {}

  private async read(path: string, allowMissing = false): Promise<unknown> {
    const response = await this.http.fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/${path}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    if (allowMissing && response.status === 404) {
      const error = missingWorkerSchema.safeParse(await response.json());
      if (
        error.success &&
        error.data.errors.some((item) => item.code === 10007)
      )
        return MISSING_WORKER;
    }
    if (!response.ok)
      throw new Error(`Cloudflare inventory ${path}: HTTP ${response.status}`);
    const envelope = z
      .object({ success: z.literal(true), result: z.unknown() })
      .parse(await response.json());
    return envelope.result;
  }

  async namespaces(): Promise<readonly WorkerNamespace[]> {
    const namespaces: WorkerNamespace[] = [];
    for (let page = 1; ; page += 1) {
      const result = z
        .array(namespaceSchema)
        .parse(
          await this.read(
            `workers/durable_objects/namespaces?page=${String(page)}&per_page=100`
          )
        );
      namespaces.push(...result);
      if (result.length < 100) return namespaces;
    }
  }

  async domains(): Promise<readonly WorkerDomain[]> {
    return z.array(domainSchema).parse(await this.read('workers/domains'));
  }

  async scriptExists(script: string): Promise<boolean> {
    const settings = await this.read(
      `workers/scripts/${script}/settings`,
      true
    );
    if (settings === MISSING_WORKER) return false;
    z.object({ bindings: z.array(bindingSchema) }).parse(settings);
    return true;
  }

  async roomNamespaceId(script: string): Promise<string> {
    const settings = z
      .object({ bindings: z.array(bindingSchema) })
      .parse(await this.read(`workers/scripts/${script}/settings`));
    const room = settings.bindings.find(
      (binding) =>
        binding.type === 'durable_object_namespace' && binding.name === 'ROOM'
    );
    if (room?.namespace_id === undefined)
      throw new Error('Application ROOM binding is missing');
    return room.namespace_id;
  }
}
