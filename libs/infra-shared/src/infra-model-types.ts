/**
 * The infrastructure model: what the OpenTofu configuration declares, with
 * names, instance keys and console links resolved for each environment.
 * Plain data; `infra-model` builds it and `infra-render` draws it.
 */

import type { ExternalRef, Link } from './infra-kinds';

export type InstanceModel = {
  readonly key: string | number | null;
  /** Best identifying name for this instance (its key, else a name attr). */
  readonly label: string | null;
  readonly links: readonly Link[];
};

export type NodeModel = {
  /** Stack-relative address, e.g. `module.pubsub.aws_iam_role.authorizer`. */
  readonly address: string;
  readonly mode: 'managed' | 'data';
  readonly type: string;
  readonly name: string;
  readonly provider: string;
  readonly title: string;
  readonly logo: string;
  readonly category: string;
  readonly modulePath: readonly string[];
  /** First module segment; empty for a resource declared in the stack. */
  readonly group: string;
  readonly expansion: 'single' | 'count' | 'for_each' | 'unknown';
  readonly instances: readonly InstanceModel[];
  /** Things outside OpenTofu this resource points at, deduplicated. */
  readonly externals: readonly ExternalRef[];
  /** Some instance carries data and the policy never deletes it. */
  readonly stateful: boolean;
  readonly preventDestroy: boolean;
  readonly adopted: boolean;
  readonly file: string;
  readonly line: number;
};

export type EdgeModel = { readonly from: string; readonly to: string };

export type ModuleModel = {
  /** Dotted module path, e.g. `pubsub`. */
  readonly name: string;
  readonly path: readonly string[];
  readonly description: string;
  readonly dir: string;
  readonly addresses: readonly string[];
};

export type ProviderUse = {
  readonly name: string;
  readonly source: string | null;
  readonly constraint: string | null;
  readonly locked: string | null;
};

export type RemovedModel = {
  readonly address: string;
  readonly provider: string;
  readonly type: string;
  readonly destroy: boolean;
};

export type StackModel = {
  readonly stack: string;
  readonly env: string | null;
  readonly description: string;
  readonly dir: string;
  readonly nodes: readonly NodeModel[];
  readonly edges: readonly EdgeModel[];
  readonly modules: readonly ModuleModel[];
  readonly providers: readonly ProviderUse[];
  readonly state: {
    readonly bucket: string | null;
    readonly key: string | null;
    readonly encrypted: boolean;
  };
  readonly removed: readonly RemovedModel[];
  readonly diagnostics: readonly { file: string; message: string }[];
};

export type EnvModel = {
  readonly env: string;
  readonly displayName: string;
  readonly suffix: string;
  readonly protection: string;
  readonly hosts: Readonly<Record<string, string>>;
  readonly worker: string | null;
  readonly stacks: readonly StackModel[];
};

export type InfraModel = {
  readonly project: string;
  /** Stacks applied once for the whole project. */
  readonly globals: readonly StackModel[];
  readonly envs: readonly EnvModel[];
  /** `global.tfvars.json`, as OpenTofu is handed it. */
  readonly vars: Readonly<Record<string, unknown>>;
  readonly sourceCount: number;
};
