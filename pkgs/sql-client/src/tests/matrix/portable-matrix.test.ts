import { describe } from 'bun:test';
import { ALWAYS_FACTORIES, openBackend } from '../backends';
import { runPortableContractTests } from '../contract/portable-contract';

describe.each([...ALWAYS_FACTORIES])('portable contract — $name', (factory) => {
  runPortableContractTests(async () => (await openBackend(factory)).client, {
    name: factory.name,
    dialect: factory.dialect,
    shared: factory.kind === 'pglite',
  });
});
