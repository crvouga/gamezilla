import type { QuintWorld } from '@pkgs/quint-shared/registry';
import { bindQuintModel, setQuintWorld } from '@pkgs/quint-shared/registry';
import { interruptionBinding, interruptionWorld } from './interruption';
import { retirementBinding, retirementWorld } from './retirement';

// Each aggregate selects its public harness; action/observation bindings stay typed.
const worlds: Readonly<Record<string, QuintWorld<unknown>>> = {
  'index-interruption': interruptionWorld as QuintWorld<unknown>,
  'index-retirement': retirementWorld as QuintWorld<unknown>,
};
const owners = new WeakMap<object, QuintWorld<unknown>>();
setQuintWorld<unknown>({
  create: async (ctx) => {
    const owner = worlds[ctx.model];
    if (owner === undefined)
      throw new Error(`Unbound indexing model: ${ctx.model}`);
    const world = await owner.create(ctx);
    owners.set(world as object, owner);
    return world;
  },
  dispose: async (world) => {
    const owner = owners.get(world as object);
    if (owner === undefined)
      throw new Error('Indexing trace has no world owner');
    await owner.dispose(world);
    owners.delete(world as object);
  },
});
bindQuintModel(retirementBinding);
bindQuintModel(interruptionBinding);
