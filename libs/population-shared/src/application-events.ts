import { z } from 'zod';
import { activitySchema } from './config';

export const applicationEventSchema = z.object({
  name: z.enum([
    'Authenticated',
    'OpenedSpaces',
    'CreatedSpace',
    'JoinedSpace',
    'EnteredMatchmaking',
    'GameStarted',
    'MoveSubmitted',
    'GameCompleted',
    'RematchRequested',
    'LoggedOut',
    'RecoveryStarted',
    'SessionRestored',
    'SessionInterrupted',
    'DecisionSelected',
  ]),
  activity: activitySchema,
  action: z.string().max(256).nullable(),
  context: z
    .record(
      z.string(),
      z.union([z.string().max(2048), z.number(), z.boolean(), z.null()])
    )
    .default({}),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
