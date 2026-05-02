import { assert } from '@gamezilla/lib/assert';
import type { PatchInput } from './interface';

function patchInputId(p: PatchInput): string | undefined {
  const r = p as Record<string, unknown>;
  return typeof r['patchId'] === 'string' ? r['patchId'] : undefined;
}

function patchInputParentId(p: PatchInput): string | undefined {
  const r = p as Record<string, unknown>;
  return typeof r['parentId'] === 'string' ? r['parentId'] : undefined;
}

function topologicalSortPatchesImpl(patches: PatchInput[]): PatchInput[] {
  const batchIds = new Set<string>();
  for (const p of patches) {
    const id = patchInputId(p);
    if (id !== undefined) batchIds.add(id);
  }

  const hasIntraBatchDeps = patches.some((p) => {
    const pid = patchInputParentId(p);
    return pid !== undefined && batchIds.has(pid);
  });
  if (!hasIntraBatchDeps) return patches;

  const byId = new Map<string, PatchInput>();
  for (const p of patches) {
    const id = patchInputId(p);
    if (id !== undefined) byId.set(id, p);
  }

  const sorted: PatchInput[] = [];
  const visited = new Set<string>();

  function visit(p: PatchInput): void {
    const id = patchInputId(p);
    if (id !== undefined && visited.has(id)) return;
    if (id !== undefined) visited.add(id);

    const pid = patchInputParentId(p);
    if (pid !== undefined && byId.has(pid) && !visited.has(pid)) {
      visit(byId.get(pid)!);
    }
    sorted.push(p);
  }

  for (const p of patches) visit(p);
  return sorted;
}

/**
 * Topologically sorts patches so that a patch's parent (if also in the batch)
 * is always inserted before its child. Prevents FK violations when the wire
 * order is arbitrary.
 *
 * Invariant: output is a permutation of input — same length, same elements,
 * only the order changes. Patches without intra-batch parent references keep
 * their relative order (stable for the common case of no dependencies).
 */
export const topologicalSortPatches = assert.fn(
  {
    fn: topologicalSortPatchesImpl,

    pre(patches: PatchInput[]) {
      assert.array(patches, 'topologicalSortPatches: input must be an array');
      assert.ok(
        patches.length > 0,
        'topologicalSortPatches: input must not be empty',
        { length: patches.length }
      );
    },

    post(sorted: PatchInput[]) {
      assert.array(sorted, 'topologicalSortPatches: output must be an array');
      assert.ok(
        sorted.length > 0,
        'topologicalSortPatches: output must not be empty',
        { length: sorted.length }
      );
      const batchIds = new Set<string>();
      for (const p of sorted) {
        const id = patchInputId(p);
        if (id !== undefined) batchIds.add(id);
      }
      const emitted = new Set<string>();
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        assert.defined(p, 'topologicalSortPatches: element must be defined', {
          i,
        });
        const pid = patchInputParentId(p);
        assert.ok(
          pid === undefined || !batchIds.has(pid) || emitted.has(pid),
          'topologicalSortPatches: parent must precede child in output',
          { i, pid }
        );
        const id = patchInputId(p);
        if (id !== undefined) emitted.add(id);
      }
    },
  },
  'topologicalSortPatches'
);
