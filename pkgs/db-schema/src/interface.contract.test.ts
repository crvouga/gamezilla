import { describe } from 'bun:test';
import {
  postgresMemFactory,
  runDbSchemaContractTests,
  sqliteMemFactory,
} from './testing/contract';

describe.each([postgresMemFactory(), sqliteMemFactory()])(
  'db-schema contract matrix: $name',
  (factory) => {
    runDbSchemaContractTests(factory);
  }
);
