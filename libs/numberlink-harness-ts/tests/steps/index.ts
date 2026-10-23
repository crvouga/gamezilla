import { useNumberlinkWorld } from './world';

const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useNumberlinkWorld();
