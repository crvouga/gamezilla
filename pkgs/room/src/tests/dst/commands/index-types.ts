import type { AsyncCommand } from 'fast-check';

import type { WorldModel, WorldReal } from '../model';

export type WorldCmd = AsyncCommand<WorldModel, WorldReal>;
