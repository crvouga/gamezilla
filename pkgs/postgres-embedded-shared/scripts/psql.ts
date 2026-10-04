import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded-shared/ports';

const proc = Bun.spawn(['psql', LOCAL_DATABASE_URL], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

const code = await proc.exited;
process.exit(code);
