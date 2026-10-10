import { z } from 'zod';

const environment = z.object({
  POPULATION_API_ORIGIN: z.string().url(),
  POPULATION_WORKER_TOKEN: z.string().min(32),
  POPULATION_CAPACITY: z.coerce.number().int().min(1).max(32).default(1),
  POPULATION_SHUTDOWN_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300_000)
    .default(25_000),
  DEPLOYMENT_VERSION: z.string().min(1).max(128).default('local'),
  SECRETS_ENV: z.string().default('local'),
  DEPLOYMENT_ENVIRONMENT: z.string().optional(),
  PORT: z.coerce.number().int().min(0).max(65_535).default(8080),
});
/** Local sessions cannot accidentally target a deployed application. */
export function readWorkerEnvironment(
  input: Readonly<Record<string, string | undefined>>
) {
  const result = environment.parse(input);
  const origin = new URL(result.POPULATION_API_ORIGIN);
  if (
    origin.username !== '' ||
    origin.password !== '' ||
    origin.pathname !== '/' ||
    origin.search !== '' ||
    origin.hash !== ''
  )
    throw new Error('POPULATION_API_ORIGIN must be a plain application origin');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(
    origin.hostname
  );
  if (!loopback && result.DEPLOYMENT_ENVIRONMENT !== result.SECRETS_ENV)
    throw new Error(
      'Local Population Workers require a loopback application origin'
    );
  if (
    !loopback &&
    (origin.protocol !== 'https:' || result.DEPLOYMENT_VERSION === 'local')
  )
    throw new Error(
      'Deployed Population Workers require HTTPS and an immutable deployment version'
    );
  return result;
}
