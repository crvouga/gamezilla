import { LOCAL_DATABASE_URL } from './ports';

const proc = Bun.spawn(['psql', LOCAL_DATABASE_URL], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

const code = await proc.exited;
process.exit(code);
