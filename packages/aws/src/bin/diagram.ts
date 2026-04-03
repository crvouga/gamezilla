import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CDK_OUT = path.join(__dirname, '..', '..', 'cdk.out');
const TREE_PATH = path.join(CDK_OUT, 'tree.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..');
const DOT_PATH = path.join(OUTPUT_DIR, 'diagram.dot');
const PNG_PATH = path.join(OUTPUT_DIR, 'diagram.png');

interface TreeNode {
  id: string;
  path: string;
  attributes?: Record<string, string>;
  children?: Record<string, TreeNode>;
}

interface CfnResource {
  Type: string;
  Properties?: Record<string, unknown>;
  DependsOn?: string | string[];
}

interface DiagramNode {
  id: string;
  label: string;
  tier: string;
}

// ---------------------------------------------------------------------------
// 1. Read tree.json and discover constructs that declared diagram metadata
// ---------------------------------------------------------------------------

const tree: { tree: TreeNode } = JSON.parse(fs.readFileSync(TREE_PATH, 'utf8'));

const stackNode = Object.values(tree.tree.children ?? {}).find(
  (c) =>
    c.children &&
    Object.values(c.children).some((cc) => cc.attributes?.['diagram:label'])
);
if (!stackNode) {
  throw new Error('No stack found with diagram:label attributes in tree.json');
}

const stackName = stackNode.id;
const nodes: DiagramNode[] = [];
const constructIds: string[] = [];

for (const [id, child] of Object.entries(stackNode.children ?? {})) {
  const label = child.attributes?.['diagram:label'];
  const tier = child.attributes?.['diagram:tier'];
  if (label && tier) {
    nodes.push({ id, label, tier });
    constructIds.push(id);
  }
}

// ---------------------------------------------------------------------------
// 2. Read CFN template and derive cross-construct edges
// ---------------------------------------------------------------------------

const templatePath = path.join(CDK_OUT, `${stackName}.template.json`);
const template: { Resources: Record<string, CfnResource> } = JSON.parse(
  fs.readFileSync(templatePath, 'utf8')
);

function owningConstruct(logicalId: string): string | undefined {
  let best: string | undefined;
  for (const cid of constructIds) {
    if (logicalId.startsWith(cid) && (!best || cid.length > best.length)) {
      best = cid;
    }
  }
  return best;
}

function findRefs(obj: unknown): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const refs: string[] = [];
  const record = obj as Record<string, unknown>;
  if (typeof record['Ref'] === 'string') refs.push(record['Ref']);
  if (Array.isArray(record['Fn::GetAtt'])) {
    refs.push(record['Fn::GetAtt'][0] as string);
  }
  for (const v of Object.values(record)) {
    refs.push(...findRefs(v));
  }
  return refs;
}

const SG_TYPES = new Set([
  'AWS::EC2::SecurityGroupIngress',
  'AWS::EC2::SecurityGroupEgress',
]);

const edgeSet = new Set<string>();

for (const [logicalId, resource] of Object.entries(template.Resources)) {
  if (SG_TYPES.has(resource.Type)) continue;

  const from = owningConstruct(logicalId);
  if (!from) continue;

  const deps = Array.isArray(resource.DependsOn)
    ? resource.DependsOn
    : resource.DependsOn
      ? [resource.DependsOn]
      : [];

  for (const dep of deps) {
    const to = owningConstruct(dep);
    if (to && to !== from) edgeSet.add(`${from} -> ${to}`);
  }

  for (const ref of findRefs(resource.Properties)) {
    const to = owningConstruct(ref);
    if (to && to !== from) edgeSet.add(`${from} -> ${to}`);
  }
}

// Runtime edges not captured by CloudFormation references (e.g. the web app's
// JavaScript calls the req-res API and connects to the MQTT broker at runtime).
for (const edge of ['WebApp -> ReqRes', 'WebApp -> Emqx']) {
  edgeSet.add(edge);
}

// ---------------------------------------------------------------------------
// 3. Emit Graphviz .dot
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<
  string,
  { label: string; fillcolor: string; fontcolor: string }
> = {
  static: { label: 'Static Sites', fillcolor: '#e3f2fd', fontcolor: '#1565c0' },
  compute: { label: 'Compute', fillcolor: '#fff3e0', fontcolor: '#e65100' },
  data: { label: 'Data', fillcolor: '#e8f5e9', fontcolor: '#2e7d32' },
  network: { label: 'Network', fillcolor: '#f3e5f5', fontcolor: '#6a1b9a' },
};

const networkNodeIds = new Set(
  nodes.filter((n) => n.tier === 'network').map((n) => n.id)
);

const nodesByTier = new Map<string, DiagramNode[]>();
for (const n of nodes) {
  const list = nodesByTier.get(n.tier) ?? [];
  list.push(n);
  nodesByTier.set(n.tier, list);
}

// Left-to-right node order within tiers to minimise edge crossings.
const TIER_NODE_ORDER: Record<string, string[]> = {
  compute: ['ReqRes', 'Emqx', 'Worker'],
};
for (const [tier, order] of Object.entries(TIER_NODE_ORDER)) {
  const tierNodes = nodesByTier.get(tier);
  if (tierNodes) {
    tierNodes.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }
}

let dot = `digraph Architecture {
  graph [
    rankdir = "TB"
    fontname = "Helvetica"
    fontsize = 14
    bgcolor = "white"
    pad = 0.4
    nodesep = 0.6
    ranksep = 1.0
    splines = "spline"
    compound = true
    newrank = true
  ];

  node [
    shape = "box"
    style = "filled,rounded"
    fontname = "Helvetica"
    fontsize = 11
    fillcolor = "#ffffff"
    color = "#cccccc"
    penwidth = 1.5
    width = 2.6
    height = 0.8
  ];

  edge [
    color = "#555555"
    penwidth = 1.5
    arrowsize = 0.7
    fontname = "Helvetica"
    fontsize = 9
  ];

`;

const vpcTiers = ['compute', 'data'];
const outerTiers = ['static'];
const networkTier = nodesByTier.get('network') ?? [];

function emitCluster(tier: string, indent: string): string {
  const tierNodes = nodesByTier.get(tier);
  if (!tierNodes) return '';
  const style = TIER_STYLES[tier];
  let out = '';
  out += `${indent}subgraph "cluster_${tier}" {\n`;
  out += `${indent}  label = "${style.label}";\n`;
  out += `${indent}  labeljust = "l";\n`;
  out += `${indent}  fontsize = 13;\n`;
  out += `${indent}  fontcolor = "${style.fontcolor}";\n`;
  out += `${indent}  style = "filled,rounded";\n`;
  out += `${indent}  fillcolor = "${style.fillcolor}";\n`;
  out += `${indent}  color = "${style.fontcolor}40";\n`;
  out += `${indent}  penwidth = 1.5;\n`;
  out += `${indent}  margin = 16;\n\n`;
  for (const n of tierNodes) {
    out += `${indent}  "${n.id}" [label="${n.label}"];\n`;
  }
  out += `${indent}}\n\n`;
  return out;
}

for (const tier of outerTiers) {
  dot += emitCluster(tier, '  ');
}

if (networkTier.length > 0) {
  const netStyle = TIER_STYLES['network'];
  dot += `  subgraph "cluster_network" {\n`;
  dot += `    label = "${networkTier.map((n) => n.label).join(', ')}";\n`;
  dot += `    labeljust = "l";\n`;
  dot += `    fontsize = 13;\n`;
  dot += `    fontcolor = "${netStyle.fontcolor}";\n`;
  dot += `    style = "filled,rounded";\n`;
  dot += `    fillcolor = "${netStyle.fillcolor}";\n`;
  dot += `    color = "${netStyle.fontcolor}40";\n`;
  dot += `    penwidth = 2;\n`;
  dot += `    margin = 20;\n\n`;

  for (const tier of vpcTiers) {
    dot += emitCluster(tier, '    ');
  }

  dot += `  }\n\n`;
} else {
  for (const tier of vpcTiers) {
    dot += emitCluster(tier, '  ');
  }
}

// Keep intra-cluster edges from pulling nodes to different ranks; this
// prevents the K_{2,2} bipartite crossing between {ReqRes,Worker}→{Emqx,Database}.
const EDGE_OVERRIDES: Record<string, string> = {
  'ReqRes -> Emqx': 'constraint=false',
  'Worker -> Emqx': 'constraint=false',
};

for (const edge of [...edgeSet].sort()) {
  const parts = edge.split(' -> ');
  const from = parts[0];
  const to = parts[1];
  if (networkNodeIds.has(from) || networkNodeIds.has(to)) continue;
  const attrs = EDGE_OVERRIDES[edge];
  dot += attrs ? `  ${edge} [${attrs}];\n` : `  ${edge};\n`;
}

dot += `}\n`;

fs.writeFileSync(DOT_PATH, dot, 'utf8');
console.log(`Wrote ${DOT_PATH}`);

// ---------------------------------------------------------------------------
// 4. Render PNG
// ---------------------------------------------------------------------------

try {
  execSync(`dot -Tpng -Gdpi=200 -o "${PNG_PATH}" "${DOT_PATH}"`, {
    stdio: 'inherit',
  });
  console.log(`Rendered ${PNG_PATH}`);
} catch {
  console.error(
    'Failed to render PNG. Ensure graphviz is installed: brew install graphviz'
  );
  process.exit(1);
}
