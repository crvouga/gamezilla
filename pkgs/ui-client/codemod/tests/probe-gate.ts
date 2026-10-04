/**
 * Probe: trace convertNode on each collected node to find why conversion
 * is skipped for files that clearly contain convertible primitives.
 */

import { readFileSync } from 'node:fs';
import {
  collectNodes,
  isLeafNode,
  resolveBindings,
} from '../transform-collect';
import { convertComponent } from '../transform-components';
import { parse } from '../transform-imports';
import { isConvertibleExport } from '../transform-kinds';

const files = process.argv.slice(2);
for (const path of files) {
  const text = readFileSync(path, 'utf8');
  const source = parse(text, path.split('/').pop() ?? 'file.tsx');
  const nodes = collectNodes(source, resolveBindings(source));
  process.stdout.write(`== ${path}\n`);
  for (const node of nodes) {
    const convertible = isConvertibleExport(node.exportName);
    let conversion: string | undefined;
    if (convertible) {
      try {
        const c = convertComponent(node.exportName, node.element, source);
        conversion = c === undefined ? 'undefined(host)' : `ok tier=${c.tier}`;
      } catch (error) {
        conversion = `THREW: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    process.stdout.write(
      `   ${node.exportName} convertible=${convertible} conversion=${conversion ?? '-'}\n`
    );
  }
  const leaves = nodes.filter((n) => isLeafNode(n, nodes));
  process.stdout.write(
    `   leaves=${leaves.map((n) => n.exportName).join(',')}\n`
  );
}
