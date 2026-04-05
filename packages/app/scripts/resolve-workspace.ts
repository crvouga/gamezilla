/**
 * Docker build step — works around a Bun bug where package.json "./*" wildcard
 * exports don't resolve when the importing file lives inside a workspace sub-package.
 *
 * Expands the wildcard into explicit per-file entries derived from the filesystem.
 * Run once at image build time:  `RUN bun packages/app/scripts/resolve-workspace.ts`
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'test') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

for (const d of readdirSync('packages', { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const pkgPath = join('packages', d.name, 'package.json');

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    continue;
  }

  const exports = pkg.exports as Record<string, string> | undefined;
  if (!exports?.['./*']) continue;

  const srcDir = join('packages', d.name, 'src');
  try {
    statSync(srcDir);
  } catch {
    continue;
  }

  const generated: Record<string, string> = {};
  for (const file of walk(srcDir)) {
    const rel = relative(srcDir, file);
    const key = './' + rel.replace(/\.(ts|tsx)$/, '');
    const val = './src/' + rel;
    if (key.endsWith('/index')) generated[key.slice(0, -6)] = val;
    generated[key] = val;
  }

  pkg.exports = { ...generated, ...exports };
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log(`exports: patched ${pkgPath} (+${Object.keys(generated).length} entries)`);
}
